-- ============================================================
--  SmartParkingDB — Migration v4
--  Adds LaneID column to ParkingSlots so admins can group slots
--  into named lanes (one row per lane in the floor plan).
--  Idempotent.
-- ============================================================

USE SmartParkingDB;
GO

IF COL_LENGTH('ParkingSlots', 'LaneID') IS NULL
    ALTER TABLE ParkingSlots ADD LaneID INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParkingSlots_LaneID')
    CREATE INDEX IX_ParkingSlots_LaneID ON ParkingSlots(LaneID);
GO

-- For existing slots without a lane, group them by location into one
-- "implicit" lane each so the floor plan still renders them as a row.
-- Each location gets its own LaneID (next available).
IF EXISTS (SELECT 1 FROM ParkingSlots WHERE LaneID IS NULL)
BEGIN
    DECLARE @loc NVARCHAR(100);
    DECLARE @nextLane INT = COALESCE((SELECT MAX(LaneID) FROM ParkingSlots), 0) + 1;
    DECLARE c CURSOR FOR
        SELECT DISTINCT SlotLocation FROM ParkingSlots WHERE LaneID IS NULL;
    OPEN c;
    FETCH NEXT FROM c INTO @loc;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        UPDATE ParkingSlots SET LaneID = @nextLane
        WHERE SlotLocation = @loc AND LaneID IS NULL;
        SET @nextLane = @nextLane + 1;
        FETCH NEXT FROM c INTO @loc;
    END
    CLOSE c;
    DEALLOCATE c;
END
GO
