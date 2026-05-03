-- ============================================================
--  SmartParkingDB — Migration v2
--  Adds: check-in/check-out, dynamic pricing (PeakHours),
--        stored procedures, status trigger, reporting views.
--  Idempotent — safe to re-run.
-- ============================================================

USE SmartParkingDB;
GO

-- ────────────────────────────────────────────────────────────
--  1. New columns on Reservations (check-in / check-out)
-- ────────────────────────────────────────────────────────────
IF COL_LENGTH('Reservations', 'CheckInTime') IS NULL
    ALTER TABLE Reservations ADD CheckInTime DATETIME NULL;
GO
IF COL_LENGTH('Reservations', 'CheckOutTime') IS NULL
    ALTER TABLE Reservations ADD CheckOutTime DATETIME NULL;
GO
IF COL_LENGTH('Reservations', 'FinalAmount') IS NULL
    ALTER TABLE Reservations ADD FinalAmount DECIMAL(10,2) NULL;
GO

-- ────────────────────────────────────────────────────────────
--  2. PeakHours table — dynamic pricing rules
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('PeakHours', 'U') IS NULL
BEGIN
    CREATE TABLE PeakHours (
        PeakHourID INT          IDENTITY(1,1) PRIMARY KEY,
        StartHour  TINYINT      NOT NULL CHECK (StartHour BETWEEN 0 AND 23),
        EndHour    TINYINT      NOT NULL CHECK (EndHour   BETWEEN 1 AND 24),
        Multiplier DECIMAL(4,2) NOT NULL CHECK (Multiplier > 0),
        Label      VARCHAR(50)  NOT NULL,
        CONSTRAINT CHK_PeakHours_Range CHECK (EndHour > StartHour)
    );

    INSERT INTO PeakHours (StartHour, EndHour, Multiplier, Label) VALUES
        (8,  10, 1.50, 'Morning Rush'),
        (17, 20, 1.50, 'Evening Rush'),
        (0,   6, 0.75, 'Off-Peak Night');
END
GO

-- ────────────────────────────────────────────────────────────
--  3. sp_CalculatePrice — dynamic price for any window
--     Walks the window hour-by-hour, applies the highest
--     PeakHours multiplier that covers each hour, defaults 1.0.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_CalculatePrice', 'P') IS NOT NULL
    DROP PROCEDURE sp_CalculatePrice;
GO
CREATE PROCEDURE sp_CalculatePrice
    @SlotType VARCHAR(20),
    @Start    DATETIME,
    @End      DATETIME,
    @Total    DECIMAL(10,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @End <= @Start
    BEGIN
        SET @Total = 0;
        RETURN;
    END

    DECLARE @Rate DECIMAL(8,2);
    SELECT TOP 1 @Rate = PricePerHour
    FROM PricingRules
    WHERE SlotType = @SlotType
      AND EffectiveFrom <= CAST(GETDATE() AS DATE)
    ORDER BY EffectiveFrom DESC;

    IF @Rate IS NULL
    BEGIN
        SET @Total = 0;
        RETURN;
    END

    -- Iterate each wall-clock hour overlapping [@Start, @End).
    -- Pre-compute the per-hour value in a CTE so the outer SUM doesn't
    -- contain a correlated subquery (SQL Server forbids that combo).
    ;WITH hours AS (
        SELECT
            DATEADD(HOUR, DATEDIFF(HOUR, 0, @Start), 0)     AS H,
            DATEADD(HOUR, DATEDIFF(HOUR, 0, @Start) + 1, 0) AS HEnd
        UNION ALL
        SELECT HEnd, DATEADD(HOUR, 1, HEnd)
        FROM hours
        WHERE HEnd < @End
    ),
    hour_values AS (
        SELECT
            @Rate
            * CAST(DATEDIFF(MINUTE,
                    CASE WHEN H    > @Start THEN H    ELSE @Start END,
                    CASE WHEN HEnd < @End   THEN HEnd ELSE @End   END
                ) AS DECIMAL(10,4)) / 60.0
            * ISNULL((
                SELECT MAX(Multiplier) FROM PeakHours
                WHERE DATEPART(HOUR, H) >= StartHour
                  AND DATEPART(HOUR, H) <  EndHour
              ), 1.0) AS V
        FROM hours
        WHERE DATEDIFF(MINUTE,
                CASE WHEN H    > @Start THEN H    ELSE @Start END,
                CASE WHEN HEnd < @End   THEN HEnd ELSE @End   END
              ) > 0
    )
    SELECT @Total = COALESCE(SUM(V), 0)
    FROM hour_values
    OPTION (MAXRECURSION 1000);

    SET @Total = ISNULL(@Total, 0);
END
GO

-- ────────────────────────────────────────────────────────────
--  4. sp_CheckIn — by verification code
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_CheckIn', 'P') IS NOT NULL
    DROP PROCEDURE sp_CheckIn;
GO
CREATE PROCEDURE sp_CheckIn
    @VerificationCode VARCHAR(20),
    @ReservationID    INT          OUTPUT,
    @SlotNumber       VARCHAR(10)  OUTPUT,
    @UserName         VARCHAR(100) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ResID INT, @SlotID INT, @Status VARCHAR(20),
            @CheckIn DATETIME, @StartTime DATETIME, @EndTime DATETIME;

    SELECT @ResID = ReservationID, @SlotID = SlotID,
           @Status = ReservationStatus, @CheckIn = CheckInTime,
           @StartTime = StartTime, @EndTime = EndTime
    FROM Reservations
    WHERE VerificationCode = @VerificationCode;

    IF @ResID IS NULL
        THROW 51001, 'Invalid verification code.', 1;
    IF @Status <> 'Booked'
        THROW 51002, 'Reservation is not active.', 1;
    IF @CheckIn IS NOT NULL
        THROW 51003, 'Already checked in.', 1;
    IF GETDATE() < @StartTime
        THROW 51004, 'Too early — check-in opens at the booked start time.', 1;
    IF GETDATE() >= @EndTime
        THROW 51005, 'Reservation window has ended — cannot check in.', 1;

    UPDATE Reservations  SET CheckInTime = GETDATE() WHERE ReservationID = @ResID;
    UPDATE ParkingSlots  SET Status = 'Occupied'     WHERE SlotID = @SlotID;

    SET @ReservationID = @ResID;
    SELECT @SlotNumber = SlotNumber FROM ParkingSlots WHERE SlotID = @SlotID;
    SELECT @UserName = u.FullName
    FROM Reservations r JOIN Users u ON r.UserID = u.UserID
    WHERE r.ReservationID = @ResID;
END
GO

-- ────────────────────────────────────────────────────────────
--  5. sp_CheckOut — finalize, free slot via trigger
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_CheckOut', 'P') IS NOT NULL
    DROP PROCEDURE sp_CheckOut;
GO
CREATE PROCEDURE sp_CheckOut
    @ReservationID INT,
    @FinalAmount   DECIMAL(10,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @SlotID INT, @SlotType VARCHAR(20),
            @CheckIn DATETIME, @CheckOut DATETIME, @Status VARCHAR(20);

    SELECT @SlotID = r.SlotID, @SlotType = s.SlotType,
           @CheckIn = r.CheckInTime, @CheckOut = r.CheckOutTime,
           @Status = r.ReservationStatus
    FROM Reservations r JOIN ParkingSlots s ON r.SlotID = s.SlotID
    WHERE r.ReservationID = @ReservationID;

    IF @SlotID IS NULL    THROW 52001, 'Reservation not found.',     1;
    IF @Status <> 'Booked' THROW 52002, 'Reservation is not active.', 1;
    IF @CheckIn IS NULL   THROW 52003, 'Not checked in yet.',        1;
    IF @CheckOut IS NOT NULL THROW 52004, 'Already checked out.',    1;

    DECLARE @Now DATETIME = GETDATE();
    DECLARE @StartTime DATETIME, @EndTime DATETIME;
    SELECT @StartTime = StartTime, @EndTime = EndTime
    FROM Reservations WHERE ReservationID = @ReservationID;

    -- Bill from booked StartTime to MAX(EndTime, Now). User pays at least
    -- the booked window; overstays cost extra. Early leavers don't get
    -- a refund (typical parking behavior).
    DECLARE @BillEnd DATETIME = CASE WHEN @Now > @EndTime THEN @Now ELSE @EndTime END;
    EXEC sp_CalculatePrice @SlotType, @StartTime, @BillEnd, @FinalAmount OUTPUT;

    UPDATE Reservations
    SET CheckOutTime      = @Now,
        FinalAmount       = @FinalAmount,
        ReservationStatus = 'Completed'
    WHERE ReservationID = @ReservationID;
    -- trg_Reservation_StatusChange flips the slot back to Available
END
GO

-- ────────────────────────────────────────────────────────────
--  6. Trigger — auto-free slot on Cancel / Complete
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_Reservation_StatusChange', 'TR') IS NOT NULL
    DROP TRIGGER trg_Reservation_StatusChange;
GO
CREATE TRIGGER trg_Reservation_StatusChange
ON Reservations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(ReservationStatus) RETURN;

    UPDATE p
    SET    p.Status = 'Available'
    FROM   ParkingSlots p
    JOIN   inserted i ON p.SlotID = i.SlotID
    JOIN   deleted  d ON d.ReservationID = i.ReservationID
    WHERE  d.ReservationStatus = 'Booked'
      AND  i.ReservationStatus IN ('Cancelled', 'Completed')
      AND  p.Status IN ('Reserved', 'Occupied');
END
GO

-- ────────────────────────────────────────────────────────────
--  7. Reporting views
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('RevenueByLocation', 'V') IS NOT NULL DROP VIEW RevenueByLocation;
GO
CREATE VIEW RevenueByLocation AS
SELECT s.SlotLocation,
       COUNT(DISTINCT r.ReservationID)         AS Reservations,
       COALESCE(SUM(p.Amount), 0)              AS Revenue
FROM   ParkingSlots s
LEFT JOIN Reservations r ON s.SlotID = r.SlotID
LEFT JOIN Payments p
       ON p.ReservationID = r.ReservationID
      AND p.PaymentStatus = 'Paid'
GROUP BY s.SlotLocation;
GO

IF OBJECT_ID('PeakHoursReport', 'V') IS NOT NULL DROP VIEW PeakHoursReport;
GO
CREATE VIEW PeakHoursReport AS
SELECT DATEPART(HOUR, StartTime) AS HourOfDay,
       COUNT(*)                  AS Bookings
FROM   Reservations
WHERE  ReservationStatus IN ('Booked', 'Completed')
GROUP BY DATEPART(HOUR, StartTime);
GO

IF OBJECT_ID('TopUsers', 'V') IS NOT NULL DROP VIEW TopUsers;
GO
CREATE VIEW TopUsers AS
SELECT TOP 10
       u.UserID, u.FullName, u.Email,
       COUNT(r.ReservationID)     AS TotalReservations,
       COALESCE(SUM(p.Amount), 0) AS TotalSpent
FROM   Users u
LEFT JOIN Reservations r ON u.UserID = r.UserID
LEFT JOIN Payments p
       ON p.ReservationID = r.ReservationID
      AND p.PaymentStatus = 'Paid'
WHERE  u.UserRole = 'User'
GROUP BY u.UserID, u.FullName, u.Email
ORDER BY TotalSpent DESC, TotalReservations DESC;
GO

-- ============================================================
--  SAMPLE QUERIES
-- ============================================================
-- DECLARE @Total DECIMAL(10,2);
-- EXEC sp_CalculatePrice 'Car', '2026-05-01 09:00', '2026-05-01 11:00', @Total OUTPUT;
-- SELECT @Total AS PriceWithPeak;        -- 1h @ 1.5x + 1h @ 1.0x = 250
--
-- SELECT * FROM RevenueByLocation;
-- SELECT * FROM PeakHoursReport ORDER BY HourOfDay;
-- SELECT * FROM TopUsers;
