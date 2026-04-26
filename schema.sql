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
                 CHECK (VehicleType IN ('Car', 'Bike', 'EV')),
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
                 CHECK (SlotType IN ('Car', 'Bike', 'EV')),
    Status       VARCHAR(20)  NOT NULL DEFAULT 'Available'
                 CHECK (Status IN ('Available', 'Occupied', 'Reserved', 'Maintenance'))
);

-- ────────────────────────────────────────────────────────────
--  4. PRICING RULES
-- ────────────────────────────────────────────────────────────
CREATE TABLE PricingRules (
    PricingID     INT           IDENTITY(1,1) PRIMARY KEY,
    SlotType      VARCHAR(20)   NOT NULL
                  CHECK (SlotType IN ('Car', 'Bike', 'EV')),
    PricePerHour  DECIMAL(8,2)  NOT NULL CHECK (PricePerHour > 0),
    EffectiveFrom DATE          NOT NULL
);

-- ────────────────────────────────────────────────────────────
--  5. RESERVATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE Reservations (
    ReservationID     INT          IDENTITY(1,1) PRIMARY KEY,
    UserID            INT          NOT NULL,
    VehicleID         INT          NOT NULL,
    SlotID            INT          NOT NULL,
    StartTime         DATETIME     NOT NULL,
    EndTime           DATETIME     NOT NULL,
    VerificationCode  VARCHAR(20)  UNIQUE,
    ReservationStatus VARCHAR(20)  NOT NULL DEFAULT 'Booked'
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
('Car',  100.00, '2026-01-01'),
('Bike',  50.00, '2026-01-01'),
('EV',   120.00, '2026-01-01');

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