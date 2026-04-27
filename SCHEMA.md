# Smart Parking System — Database Schema

> **Database:** `SmartParkingDB` on Microsoft SQL Server 2022
> **Engine:** Relational, normalized to **Third Normal Form (3NF)**
> **Tables:** 6 · **Views:** 3 · **Total columns:** 37

---

## 1. Overview

The Smart Parking System tracks **who** parks **what vehicle**, in **which slot**, **for how long**, and **how much they paid**. The schema is split into six entities, each owning exactly one concern. This separation removes redundancy, makes the data easier to query, and lets the database itself enforce business rules through `CHECK`, `UNIQUE`, and `FOREIGN KEY` constraints.

### Quick map of the six entities

| Table | Owns | Lifetime |
|---|---|---|
| `Users` | Authentication & identity | Permanent |
| `Vehicles` | Cars/bikes/EVs registered to a user | Long-lived |
| `ParkingSlots` | Physical parking spaces | Permanent (admin-managed) |
| `PricingRules` | Price-per-hour by vehicle type, with effective date | Long-lived (admin-managed) |
| `Reservations` | A booking event (transactional) | Short-lived (Booked → Completed/Cancelled) |
| `Payments` | Money exchanged for a reservation | Short-lived |

### Relationship summary (Entity-Relationship Diagram in words)

```
Users ──< owns ──<  Vehicles
Users ──< makes ──<  Reservations  >── for ──> ParkingSlots
                              \
                               >── used vehicle ──> Vehicles
                               >── generates ──< Payments
PricingRules ── priced by ──> ParkingSlots (by SlotType)
```

---

## 2. Tables — purpose, columns, and rationale

### 2.1 `Users`

```sql
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
```

**Why it exists**
Every actor that can log into the system — customers and administrators — is a row in this table. Authentication concerns (email, password, role) are deliberately isolated from business data so that the booking and payment logic never has to touch credential fields.

**Key design choices**
- `UserID` is a **surrogate primary key** (auto-incrementing). Email could change, but `UserID` cannot, so foreign keys in other tables remain stable.
- `Email` and `Phone` are `UNIQUE` — no two accounts share the same identity.
- `UserRole` is a `CHECK` constraint, not a free-text field. The DB itself rejects garbage roles. The backend (`AdminController.assertAdmin`) reads this column to gate every admin endpoint.
- `RegistrationDate` defaults to `GETDATE()` — the database stamps it automatically, so the backend never has to compute it.

**How it is used**
Login (`AuthController`), admin user list (`AdminController.allUsers`), and as the `UserID` foreign key in `Vehicles` and `Reservations`.

---

### 2.2 `Vehicles`

```sql
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
```

**Why it exists — separated from `Users`**
A user can own **many** vehicles. Storing `LicensePlate` directly on `Users` would either limit each user to one car, or force you to repeat user data on every car (violating 1NF the moment a user adds a second vehicle). The separate `Vehicles` table cleanly models the **one-to-many** relationship.

**Key design choices**
- `LicensePlate UNIQUE` — no two vehicles in the system share a plate (it's a real-world unique identifier).
- `VehicleType` is constrained to the same three values as `ParkingSlots.SlotType`. The booking logic enforces that a vehicle can only park in a slot of its own type.
- `ON DELETE CASCADE` — when a user is removed, their vehicles disappear too. This avoids orphan vehicle rows pointing at a non-existent user.

**How it is used**
Listed on the user's Vehicles page (`api.myVehicles`), referenced in every reservation (`Reservations.VehicleID`), and validated server-side at booking (vehicle must exist, belong to the user, and match the slot type).

---

### 2.3 `ParkingSlots`

```sql
CREATE TABLE ParkingSlots (
    SlotID       INT          IDENTITY(1,1) PRIMARY KEY,
    SlotNumber   VARCHAR(10)  NOT NULL UNIQUE,
    SlotLocation VARCHAR(100) NOT NULL,
    SlotType     VARCHAR(20)  NOT NULL
                 CHECK (SlotType IN ('Car', 'Bike', 'EV')),
    Status       VARCHAR(20)  NOT NULL DEFAULT 'Available'
                 CHECK (Status IN ('Available','Occupied','Reserved','Maintenance'))
);
```

**Why it exists**
The lot's physical inventory is fixed; reservations come and go. Modelling slots as their own table lets you ask *"which slots are free right now?"* with a single column read on `Status`, instead of joining through a transactional table.

**Key design choices**
- `SlotNumber` is the **human-readable** unique label (e.g. `A1`, `B3`, `EV2`). `SlotID` is the surrogate key used by foreign keys.
- `SlotLocation` is a `VARCHAR` rather than a foreign key to a `Locations` table. This is a deliberate trade-off: locations have no attributes of their own (no manager, no address, no opening hours). If they did, we would normalize further into a `Locations` table.
- `Status` is a small **state machine** enforced by the database: `Available → Reserved` (on booking), `Reserved → Available` (on cancel), `Reserved → Occupied` (on check-in, future deliverable), and `* → Maintenance` (admin-only).

**How it is used**
Drives the floor-plan UI on the dashboard (color-coded by `Status`), the booking flow (only `Available` slots can be reserved), the admin slot-CRUD page, and the per-floor stat counters.

---

### 2.4 `PricingRules`

```sql
CREATE TABLE PricingRules (
    PricingID     INT           IDENTITY(1,1) PRIMARY KEY,
    SlotType      VARCHAR(20)   NOT NULL
                  CHECK (SlotType IN ('Car', 'Bike', 'EV')),
    PricePerHour  DECIMAL(8,2)  NOT NULL CHECK (PricePerHour > 0),
    EffectiveFrom DATE          NOT NULL
);
```

**Why it exists — and why it is its own table**
Prices apply to **slot types**, not individual slots. If `PricePerHour` were stored on `ParkingSlots`, it would be repeated on every Car slot — fifty Car slots, fifty copies of `100.00`. That violates 3NF (`PricePerHour` would depend on `SlotType`, not on `SlotID`).

Putting price in its own table also makes **price history** possible. When the rate changes, you insert a new row with a later `EffectiveFrom` date. Old reservations stay priced at the rate that was active when they were booked.

**Key design choices**
- `PricePerHour CHECK > 0` — the database itself rejects zero or negative rates.
- `EffectiveFrom` lets you keep historical rates. The reservation creator selects the *current* rate with `SELECT TOP 1 ... ORDER BY EffectiveFrom DESC`.
- No FK from `PricingRules.SlotType` to `ParkingSlots.SlotType` is needed — both columns reference the same `CHECK` enum, which keeps them in sync.

**How it is used**
Read on every booking to compute the fare. Displayed on the dashboard pricing card. Managed by admins through the Pricing tab (CRUD).

---

### 2.5 `Reservations` — the central transactional table

```sql
CREATE TABLE Reservations (
    ReservationID     INT          IDENTITY(1,1) PRIMARY KEY,
    UserID            INT          NOT NULL,
    VehicleID         INT          NOT NULL,
    SlotID            INT          NOT NULL,
    StartTime         DATETIME     NOT NULL,
    EndTime           DATETIME     NOT NULL,
    VerificationCode  VARCHAR(20)  UNIQUE,
    ReservationStatus VARCHAR(20)  NOT NULL DEFAULT 'Booked'
                      CHECK (ReservationStatus IN ('Booked','Cancelled','Completed')),

    CONSTRAINT CHK_Reservation_Times CHECK (EndTime > StartTime),

    CONSTRAINT FK_Reservation_User
        FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    CONSTRAINT FK_Reservation_Vehicle
        FOREIGN KEY (VehicleID) REFERENCES Vehicles(VehicleID),
    CONSTRAINT FK_Reservation_Slot
        FOREIGN KEY (SlotID) REFERENCES ParkingSlots(SlotID)
);
```

**Why it exists — the "transaction" of the system**
This is the table that ties everything together. A reservation is meaningless without all three references: **who** booked, **what** vehicle they used, and **which** slot they took. Every report (mine, all, by status, by date, revenue) starts from this table.

**Key design choices**
- Three foreign keys form the join skeleton of the entire schema.
- `CHK_Reservation_Times CHECK (EndTime > StartTime)` — the database itself prevents reservations with non-positive duration. This is enforced even if the application code is buggy.
- `VerificationCode VARCHAR(20) UNIQUE` — generated server-side as a 6-character random string (e.g. `ABC123`). It will be the QR-code payload in Deliverable 4 when an operator scans the customer in.
- `ReservationStatus` is a small lifecycle enum:
  - `Booked` → `Cancelled` (user cancels with at least 1 hour notice)
  - `Booked` → `Completed` (after check-out, future deliverable)
- `ON DELETE CASCADE` from `UserID` ensures that deleting a user wipes their booking history. We deliberately do **not** cascade from `SlotID` or `VehicleID` so that admins can't accidentally erase reservation history by deleting infrastructure.

**Business rules enforced server-side (in addition to DB constraints)**
1. The vehicle must **exist**, **belong to the user**, and **match the slot type**.
2. A vehicle can have **only one active `Booked` reservation at a time** — you can't book a second slot until the current booking ends.
3. Cancellation must happen **at least 1 hour before** `StartTime`.
4. Slot status must be `Available` at the moment of booking, and is transactionally flipped to `Reserved`.

**How it is used**
The booking flow, the user's "My Reservations" page, the admin all-reservations view, and as a join target for every payment query.

---

### 2.6 `Payments`

```sql
CREATE TABLE Payments (
    PaymentID     INT           IDENTITY(1,1) PRIMARY KEY,
    ReservationID INT           NOT NULL,
    Amount        DECIMAL(10,2) NOT NULL CHECK (Amount > 0),
    PaymentMethod VARCHAR(20)   NOT NULL
                  CHECK (PaymentMethod IN ('Cash','Card','Online')),
    PaymentDate   DATETIME      DEFAULT GETDATE(),
    PaymentStatus VARCHAR(20)   NOT NULL DEFAULT 'Paid'
                  CHECK (PaymentStatus IN ('Paid','Pending','Failed')),

    CONSTRAINT FK_Payment_Reservation
        FOREIGN KEY (ReservationID) REFERENCES Reservations(ReservationID)
        ON DELETE CASCADE
);
```

**Why it exists — separated from `Reservations`**
A reservation can be unpaid, paid in cash later, or paid in multiple attempts (Pending → Failed → Paid). Storing payment data directly on the reservation row would only allow **one** attempt and would lose history every time the user retried.

`PaymentID` is `IDENTITY` — every attempt gets a fresh primary key, so even three failed attempts plus one successful payment for the same `ReservationID` produce four distinct rows with no PK collision:

| PaymentID | ReservationID | Amount | Status  |
|-----------|---------------|--------|---------|
| 101       | 42            | 200.00 | Failed  |
| 102       | 42            | 200.00 | Pending |
| 103       | 42            | 200.00 | Paid    |

**Key design choices**
- `Amount` is **stored** rather than recomputed. The pricing rule could change after the booking; storing what was actually charged at payment time keeps history accurate.
- `PaymentDate` defaults to `GETDATE()` — DB-stamped at insert.
- `ON DELETE CASCADE` — deleting a reservation also wipes its payment trail.

**How it is used**
The `PayModal` on the user's reservations page, the admin payments table, and the `SUM(Amount)` revenue calculation in the admin overview.

---

## 3. Views — encapsulated joins

Views are **saved queries** that look like tables. Three views encapsulate frequent multi-table joins so the application doesn't have to repeat the SQL.

### `AvailableSlots`
```sql
CREATE VIEW AvailableSlots AS
SELECT SlotID, SlotNumber, SlotLocation, SlotType
FROM   ParkingSlots
WHERE  Status = 'Available';
```
Used wherever you need only the free slots.

### `ReservationDetails`
```sql
CREATE VIEW ReservationDetails AS
SELECT r.ReservationID, u.FullName, v.LicensePlate, v.VehicleType,
       p.SlotNumber, p.SlotLocation, r.StartTime, r.EndTime, r.ReservationStatus
FROM Reservations r
JOIN Users        u ON r.UserID    = u.UserID
JOIN Vehicles     v ON r.VehicleID = v.VehicleID
JOIN ParkingSlots p ON r.SlotID    = p.SlotID;
```
A flat row containing everything the admin reservation screen needs.

### `PaymentHistory`
```sql
CREATE VIEW PaymentHistory AS
SELECT pay.PaymentID, u.FullName, pay.Amount, pay.PaymentMethod,
       pay.PaymentDate, pay.PaymentStatus
FROM Payments      pay
JOIN Reservations  r ON pay.ReservationID = r.ReservationID
JOIN Users         u ON r.UserID          = u.UserID;
```
"Who paid what." The `AdminController.allPayments` endpoint literally runs `SELECT * FROM PaymentHistory ORDER BY PaymentDate DESC`.

---

## 4. Constraints summary (database-enforced rules)

| Type | Where | Purpose |
|---|---|---|
| `PRIMARY KEY` | All 6 tables | Unique row identity |
| `IDENTITY(1,1)` | All PKs | Auto-incrementing surrogate keys |
| `FOREIGN KEY` | 6 references | Referential integrity |
| `ON DELETE CASCADE` | Vehicles→Users, Reservations→Users, Payments→Reservations | Auto-cleanup of dependent rows |
| `UNIQUE` | Email, Phone, LicensePlate, SlotNumber, VerificationCode | Prevent duplicate identifiers |
| `CHECK` (enum) | UserRole, VehicleType, SlotType, Status, ReservationStatus, PaymentMethod, PaymentStatus | DB-level enums |
| `CHECK` (range) | PricePerHour > 0, Amount > 0, EndTime > StartTime | Sanity rules |
| `DEFAULT` | UserRole='User', RegistrationDate=GETDATE(), Status='Available', PaymentDate=GETDATE() | Sensible defaults |

---

## 5. Normalization (3NF) — why it matters

A table is in 3NF when:
1. It is in 2NF (no partial dependency on a composite key).
2. **No transitive dependency** — non-key columns depend only on the primary key, not on other non-key columns.

Examples from this schema:
- `PricePerHour` is in `PricingRules`, not `ParkingSlots`, because it depends on `SlotType`, not on the individual `SlotID`.
- `LicensePlate`, `Brand`, `Model` are in `Vehicles`, not `Users`, because they describe vehicles, not the owning user.
- Payment status and method are in `Payments`, not `Reservations`, because one reservation can have multiple payment events.

The result: **no redundancy, no update anomalies, and no insert/delete anomalies.**

---

## 6. Common queries (read patterns the schema is shaped for)

```sql
-- 1. List all available slots on the Ground Floor
SELECT * FROM AvailableSlots WHERE SlotLocation = 'Ground Floor';

-- 2. A user's full reservation history with payment status
SELECT r.ReservationID, s.SlotNumber, r.StartTime, r.EndTime,
       r.ReservationStatus, p.PaymentStatus
FROM   Reservations r
JOIN   ParkingSlots s ON r.SlotID = s.SlotID
LEFT JOIN Payments  p ON p.ReservationID = r.ReservationID
WHERE  r.UserID = 1
ORDER BY r.StartTime DESC;

-- 3. Current rate for Cars
SELECT TOP 1 PricePerHour
FROM   PricingRules
WHERE  SlotType = 'Car'
ORDER BY EffectiveFrom DESC;

-- 4. Total revenue (admin dashboard)
SELECT COALESCE(SUM(Amount), 0)
FROM   Payments
WHERE  PaymentStatus = 'Paid';

-- 5. Slots per location (admin breakdown)
SELECT SlotLocation, COUNT(*) AS Total,
       SUM(CASE WHEN Status='Available' THEN 1 ELSE 0 END) AS Available
FROM   ParkingSlots
GROUP BY SlotLocation;
```

---

## 7. Server-side business rules layered on top of the schema

The schema enforces *structural* correctness; the backend enforces *business* correctness. Both layers matter.

| Rule | Enforced where |
|---|---|
| Email/plate/slot number unique | DB (`UNIQUE`) |
| `EndTime > StartTime` | DB (`CHECK`) |
| Valid roles, types, statuses | DB (`CHECK` enums) |
| Vehicle exists, belongs to user, matches slot type | Backend (`ReservationsController.create`) |
| One active `Booked` reservation per vehicle | Backend |
| Cancel only ≥ 1 hour before `StartTime` | Backend |
| Atomic insert + slot status flip | Backend (`@Transactional`) |
| Payments cannot exceed once-per-reservation as `Paid` | Backend (`PaymentsController.pay`) |

---

## 8. Files

- `schema.sql` — full DDL, view definitions, sample data, sample queries
- `backend/src/main/java/com/group8/smartparking/` — controllers that read/write each table
- `frontend/src/api.js` — the HTTP client mapping each REST endpoint to a DB-backed action
