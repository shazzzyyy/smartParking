CREATE DATABASE SmartParkingDB;

USE SmartParkingDB;

-- ────────────────────────────────────────────────────────────
--  1. USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE Users (
    UserID           INT           IDENTITY(1,1) PRIMARY KEY,
    FullName         VARCHAR(100)  NOT NULL,
    Email            VARCHAR(100)  NOT NULL UNIQUE,
    PasswordHash     VARCHAR(200)  NOT NULL,
    Phone            VARCHAR(15)   UNIQUE,
    UserRole         VARCHAR(20)   NOT NULL DEFAULT 'User'
                     CHECK (UserRole IN ('User', 'Admin')),
    RegistrationDate DATE          DEFAULT GETDATE()
);

-- ────────────────────────────────────────────────────────────
--  2. VEHICLES
-- ────────────────────────────────────────────────────────────
CREATE TABLE Vehicles (
    VehicleID    INT          IDENTITY(1,1) PRIMARY KEY,
    UserID       INT          NOT NULL,
    LicensePlate VARCHAR(20)  NOT NULL UNIQUE,
    VehicleType  VARCHAR(20)  NOT NULL
                 CHECK (VehicleType IN ('Car', 'Bike', 'EBike', 'EV')),
    Brand        VARCHAR(50),
    Model        VARCHAR(50),
    Color        VARCHAR(30),

    CONSTRAINT FK_Vehicle_User
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE
);

-- ────────────────────────────────────────────────────────────
--  3. PARKING SLOTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE ParkingSlots (
    SlotID       INT          IDENTITY(1,1) PRIMARY KEY,
    SlotNumber   VARCHAR(10)  NOT NULL UNIQUE,
    SlotLocation VARCHAR(100) NOT NULL,
    SlotType     VARCHAR(20)  NOT NULL
                 CHECK (SlotType IN ('Car', 'Bike', 'EBike', 'EV')),
    Status       VARCHAR(20)  NOT NULL DEFAULT 'Available'
                 CHECK (Status IN ('Available', 'Occupied', 'Reserved', 'Maintenance'))
);

-- ────────────────────────────────────────────────────────────
--  4. PRICING RULES
-- ────────────────────────────────────────────────────────────
CREATE TABLE PricingRules (
    PricingID     INT           IDENTITY(1,1) PRIMARY KEY,
    SlotType      VARCHAR(20)   NOT NULL
                  CHECK (SlotType IN ('Car', 'Bike', 'EBike', 'EV')),
    PricePerHour  DECIMAL(8,2)  NOT NULL CHECK (PricePerHour > 0),
    EffectiveFrom DATE          NOT NULL
);

-- ────────────────────────────────────────────────────────────
--  5. RESERVATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE Reservations (
    ReservationID     INT           IDENTITY(1,1) PRIMARY KEY,
    UserID            INT           NOT NULL,
    VehicleID         INT           NOT NULL,
    SlotID            INT           NOT NULL,
    StartTime         DATETIME      NOT NULL,
    EndTime           DATETIME      NOT NULL,
    VerificationCode  VARCHAR(20)   UNIQUE,
    CheckInTime       DATETIME      NULL,
    CheckOutTime      DATETIME      NULL,
    FinalAmount       DECIMAL(10,2) NULL,
    ReservationStatus VARCHAR(20)   NOT NULL DEFAULT 'Booked'
                      CHECK (ReservationStatus IN ('Booked', 'Cancelled', 'Completed')),

    CONSTRAINT CHK_Reservation_Times CHECK (EndTime > StartTime),

    CONSTRAINT FK_Reservation_User
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
    ON DELETE CASCADE,

    CONSTRAINT FK_Reservation_Vehicle
    FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID),

    CONSTRAINT FK_Reservation_Slot
    FOREIGN KEY (SlotID) REFERENCES ParkingSlots(SlotID)
);

-- ────────────────────────────────────────────────────────────
--  6a. PEAK HOURS (dynamic-pricing rules)
-- ────────────────────────────────────────────────────────────
CREATE TABLE PeakHours (
    PeakHourID INT          IDENTITY(1,1) PRIMARY KEY,
    StartHour  TINYINT      NOT NULL CHECK (StartHour BETWEEN 0 AND 23),
    EndHour    TINYINT      NOT NULL CHECK (EndHour   BETWEEN 1 AND 24),
    Multiplier DECIMAL(4,2) NOT NULL CHECK (Multiplier > 0),
    Label      VARCHAR(50)  NOT NULL,
    CONSTRAINT CHK_PeakHours_Range CHECK (EndHour > StartHour)
);

-- ────────────────────────────────────────────────────────────
--  5b. EXTENSION REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE ExtensionRequests (
    ExtensionRequestID INT          IDENTITY(1,1) PRIMARY KEY,
    ReservationID      INT          NOT NULL,
    RequestedEndTime   DATETIME     NOT NULL,
    UserNote           VARCHAR(200) NULL,
    Status             VARCHAR(20)  NOT NULL DEFAULT 'Pending'
                       CHECK (Status IN ('Pending', 'Approved', 'Denied')),
    AdminNote          VARCHAR(200) NULL,
    CreatedAt          DATETIME     NOT NULL DEFAULT GETDATE(),
    ResolvedAt         DATETIME     NULL,
    ResolvedBy         INT          NULL,

    CONSTRAINT FK_Extension_Reservation
        FOREIGN KEY (ReservationID) REFERENCES Reservations(ReservationID)
        ON DELETE CASCADE,
    CONSTRAINT FK_Extension_ResolvedBy
        FOREIGN KEY (ResolvedBy) REFERENCES Users(UserID)
);

-- ────────────────────────────────────────────────────────────
--  6. PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE Payments (
    PaymentID     INT           IDENTITY(1,1) PRIMARY KEY,
    ReservationID INT           NOT NULL,
    Amount        DECIMAL(10,2) NOT NULL CHECK (Amount > 0),
    PaymentMethod VARCHAR(20)   NOT NULL
                  CHECK (PaymentMethod IN ('Cash', 'Card', 'Online')),
    PaymentDate   DATETIME      DEFAULT GETDATE(),
    PaymentStatus VARCHAR(20)   NOT NULL DEFAULT 'Paid'
                  CHECK (PaymentStatus IN ('Paid', 'Pending', 'Failed')),

    CONSTRAINT FK_Payment_Reservation
        FOREIGN KEY (ReservationID) REFERENCES Reservations(ReservationID)
        ON DELETE CASCADE
);

GO

-- ============================================================
--  VIEWS
-- ============================================================

-- Available parking slots
CREATE VIEW AvailableSlots AS
SELECT SlotID, SlotNumber, SlotLocation, SlotType
FROM   ParkingSlots
WHERE  Status = 'Available';

GO

-- Reservation details with user, vehicle, and slot info
CREATE VIEW ReservationDetails AS
SELECT r.ReservationID,
       u.FullName,
       v.LicensePlate,
       v.VehicleType,
       p.SlotNumber,
       p.SlotLocation,
       r.StartTime,
       r.EndTime,
       r.ReservationStatus
FROM   Reservations r
JOIN   Users        u ON r.UserID    = u.UserID
JOIN   Vehicles     v ON r.VehicleID = v.VehicleID
JOIN   ParkingSlots p ON r.SlotID    = p.SlotID;

GO

-- Payment history with user info
CREATE VIEW PaymentHistory AS
SELECT pay.PaymentID,
       u.FullName,
       pay.Amount,
       pay.PaymentMethod,
       pay.PaymentDate,
       pay.PaymentStatus
FROM   Payments     pay
JOIN   Reservations r ON pay.ReservationID = r.ReservationID
JOIN   Users        u ON r.UserID          = u.UserID;

GO

-- ============================================================
--  SAMPLE DATA
-- ============================================================

INSERT INTO Users (FullName, Email, PasswordHash, Phone, UserRole)
VALUES
('Haider Ali',      'haider@gmail.com', 'pass123', '03001234567', 'User'),
('Muhammad Ahmad',  'ahmad@gmail.com',  'pass456', '03111234567', 'User'),
('Saba Fatima',     'saba@gmail.com',   'pass478', '03221234567', 'Admin');

INSERT INTO Vehicles (UserID, LicensePlate, VehicleType, Brand, Model, Color)
VALUES
(1, 'LEA-1234', 'Car',  'Toyota', 'Corolla', 'White'),
(1, 'LEA-5678', 'Bike', 'Honda',  'CB150R',  'Black'),
(2, 'LHR-9012', 'Car',  'Honda',  'Civic',   'Grey'),
(3, 'ISB-3456', 'EV',   'Tesla',  'Model 3', 'Red');

INSERT INTO ParkingSlots (SlotNumber, SlotLocation, SlotType)
VALUES
('A1',  'Ground Floor',  'Car'),
('A2',  'Ground Floor',  'Car'),
('B1',  'Basement',      'Bike'),
('EV1', 'Entrance',      'EV'),
('C1',  'Second Floor',  'Car');

INSERT INTO PricingRules (SlotType, PricePerHour, EffectiveFrom)
VALUES
('Car',   100.00, '2026-01-01'),
('Bike',   50.00, '2026-01-01'),
('EBike',  70.00, '2026-01-01'),
('EV',    120.00, '2026-01-01');

INSERT INTO PeakHours (StartHour, EndHour, Multiplier, Label) VALUES
(8,  10, 1.50, 'Morning Rush'),
(17, 20, 1.50, 'Evening Rush'),
(0,   6, 0.75, 'Off-Peak Night');

INSERT INTO Reservations (UserID, VehicleID, SlotID, StartTime, EndTime, VerificationCode)
VALUES
(1, 1, 1, '2026-04-01 10:00', '2026-04-01 12:00', 'ABC123'),
(2, 3, 2, '2026-04-01 11:00', '2026-04-01 13:00', 'XYZ789');

INSERT INTO Payments (ReservationID, Amount, PaymentMethod)
VALUES
(1, 200.00, 'Online'),
(2, 200.00, 'Cash');

-- ============================================================
--  SAMPLE QUERIES
-- ============================================================

SELECT * FROM Users;
SELECT * FROM Vehicles;
SELECT * FROM ParkingSlots;
SELECT * FROM PricingRules;
SELECT * FROM Reservations;
SELECT * FROM Payments;

SELECT * FROM AvailableSlots;
SELECT * FROM ReservationDetails;
SELECT * FROM PaymentHistory;

-- Mark slot as occupied
UPDATE ParkingSlots
SET    Status = 'Occupied'
WHERE  SlotID = 1;

-- Cancel a reservation
DELETE FROM Reservations
WHERE  ReservationID = 2;

-- ============================================================
--  STORED PROCEDURES, TRIGGERS, REPORTING VIEWS
--  (mirrored from migration_v2.sql — re-run that script
--   on existing databases to apply just these objects.)
-- ============================================================
GO

-- sp_CalculatePrice — dynamic pricing using PeakHours multipliers
CREATE PROCEDURE sp_CalculatePrice
    @SlotType VARCHAR(20),
    @Start    DATETIME,
    @End      DATETIME,
    @Total    DECIMAL(10,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF @End <= @Start BEGIN SET @Total = 0; RETURN; END

    DECLARE @Rate DECIMAL(8,2);
    SELECT TOP 1 @Rate = PricePerHour
    FROM PricingRules
    WHERE SlotType = @SlotType
      AND EffectiveFrom <= CAST(GETDATE() AS DATE)
    ORDER BY EffectiveFrom DESC;

    IF @Rate IS NULL BEGIN SET @Total = 0; RETURN; END

    ;WITH hours AS (
        SELECT
            DATEADD(HOUR, DATEDIFF(HOUR, 0, @Start), 0)     AS H,
            DATEADD(HOUR, DATEDIFF(HOUR, 0, @Start) + 1, 0) AS HEnd
        UNION ALL
        SELECT HEnd, DATEADD(HOUR, 1, HEnd) FROM hours WHERE HEnd < @End
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
    SELECT @Total = COALESCE(SUM(V), 0) FROM hour_values OPTION (MAXRECURSION 1000);

    SET @Total = ISNULL(@Total, 0);
END
GO

-- sp_CheckIn — by verification code
CREATE PROCEDURE sp_CheckIn
    @VerificationCode VARCHAR(20),
    @ReservationID    INT          OUTPUT,
    @SlotNumber       VARCHAR(10)  OUTPUT,
    @UserName         VARCHAR(100) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ResID INT, @SlotID INT, @Status VARCHAR(20),
            @CheckIn DATETIME, @StartTime DATETIME;

    SELECT @ResID = ReservationID, @SlotID = SlotID,
           @Status = ReservationStatus, @CheckIn = CheckInTime,
           @StartTime = StartTime
    FROM Reservations WHERE VerificationCode = @VerificationCode;

    IF @ResID IS NULL    THROW 51001, 'Invalid verification code.', 1;
    IF @Status <> 'Booked' THROW 51002, 'Reservation is not active.', 1;
    IF @CheckIn IS NOT NULL THROW 51003, 'Already checked in.', 1;
    IF DATEDIFF(MINUTE, GETDATE(), @StartTime) > 30
        THROW 51004, 'Too early — check-in opens 30 minutes before start time.', 1;

    UPDATE Reservations  SET CheckInTime = GETDATE() WHERE ReservationID = @ResID;
    UPDATE ParkingSlots  SET Status = 'Occupied'     WHERE SlotID = @SlotID;

    SET @ReservationID = @ResID;
    SELECT @SlotNumber = SlotNumber FROM ParkingSlots WHERE SlotID = @SlotID;
    SELECT @UserName = u.FullName
    FROM Reservations r JOIN Users u ON r.UserID = u.UserID
    WHERE r.ReservationID = @ResID;
END
GO

-- sp_CheckOut — finalize, trigger frees the slot
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

    DECLARE @BillEnd DATETIME = CASE WHEN @Now > @EndTime THEN @Now ELSE @EndTime END;
    EXEC sp_CalculatePrice @SlotType, @StartTime, @BillEnd, @FinalAmount OUTPUT;

    UPDATE Reservations
    SET CheckOutTime      = @Now,
        FinalAmount       = @FinalAmount,
        ReservationStatus = 'Completed'
    WHERE ReservationID = @ReservationID;
END
GO

-- Trigger — auto-free slot on Cancel / Complete
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

-- Reporting views
CREATE VIEW RevenueByLocation AS
SELECT s.SlotLocation,
       COUNT(DISTINCT r.ReservationID) AS Reservations,
       COALESCE(SUM(p.Amount), 0)      AS Revenue
FROM   ParkingSlots s
LEFT JOIN Reservations r ON s.SlotID = r.SlotID
LEFT JOIN Payments p
       ON p.ReservationID = r.ReservationID
      AND p.PaymentStatus = 'Paid'
GROUP BY s.SlotLocation;
GO

CREATE VIEW PeakHoursReport AS
SELECT DATEPART(HOUR, StartTime) AS HourOfDay,
       COUNT(*)                  AS Bookings
FROM   Reservations
WHERE  ReservationStatus IN ('Booked', 'Completed')
GROUP BY DATEPART(HOUR, StartTime);
GO

CREATE VIEW ExtensionRequestDetails AS
SELECT  er.ExtensionRequestID,
        er.ReservationID,
        er.RequestedEndTime,
        er.UserNote,
        er.Status,
        er.AdminNote,
        er.CreatedAt,
        er.ResolvedAt,
        er.ResolvedBy,
        r.UserID,
        r.StartTime    AS ReservationStart,
        r.EndTime      AS ReservationEnd,
        r.ReservationStatus,
        r.CheckInTime,
        u.FullName     AS UserName,
        u.Email        AS UserEmail,
        s.SlotID,
        s.SlotNumber,
        s.SlotLocation,
        s.SlotType
FROM    ExtensionRequests er
JOIN    Reservations  r ON er.ReservationID = r.ReservationID
JOIN    Users         u ON r.UserID         = u.UserID
JOIN    ParkingSlots  s ON r.SlotID         = s.SlotID;
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