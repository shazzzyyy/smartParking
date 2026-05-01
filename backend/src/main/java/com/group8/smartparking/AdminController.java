package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JdbcTemplate jdbc;

    public AdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private void assertAdmin(int userId) {
        String role;
        try {
            role = jdbc.queryForObject(
                "SELECT UserRole FROM Users WHERE UserID = ?",
                String.class, userId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "User not found");
        }
        if (!"Admin".equals(role)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin access required");
        }
    }

    // ───────────── DASHBOARD STATS ─────────────
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam int userId) {
        assertAdmin(userId);
        Map<String, Object> out = new HashMap<>();
        out.put("totalSlots", jdbc.queryForObject("SELECT COUNT(*) FROM ParkingSlots", Integer.class));
        out.put("availableSlots", jdbc.queryForObject("SELECT COUNT(*) FROM ParkingSlots WHERE Status = 'Available'", Integer.class));
        out.put("occupiedSlots", jdbc.queryForObject("SELECT COUNT(*) FROM ParkingSlots WHERE Status = 'Occupied'", Integer.class));
        out.put("reservedSlots", jdbc.queryForObject("SELECT COUNT(*) FROM ParkingSlots WHERE Status = 'Reserved'", Integer.class));
        out.put("maintenanceSlots", jdbc.queryForObject("SELECT COUNT(*) FROM ParkingSlots WHERE Status = 'Maintenance'", Integer.class));
        out.put("totalUsers", jdbc.queryForObject("SELECT COUNT(*) FROM Users WHERE UserRole = 'User'", Integer.class));
        out.put("activeReservations", jdbc.queryForObject("SELECT COUNT(*) FROM Reservations WHERE ReservationStatus = 'Booked'", Integer.class));
        BigDecimal revenue = jdbc.queryForObject(
            "SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE PaymentStatus = 'Paid'",
            BigDecimal.class
        );
        out.put("totalRevenue", revenue);
        return out;
    }

    // ───────────── SLOT CRUD ─────────────
    public record SlotReq(String slotNumber, String slotLocation, String slotType, String status, Integer laneId) {}

    @PostMapping("/slots")
    public Map<String, Object> createSlot(@RequestParam int userId, @RequestBody SlotReq req) {
        assertAdmin(userId);
        if (req.slotNumber == null || req.slotLocation == null || req.slotType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotNumber, slotLocation, slotType required");
        }
        if (!List.of("Car", "Bike", "EBike", "EV").contains(req.slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType must be Car, Bike, EBike or EV");
        }

        Integer dup = jdbc.queryForObject(
            "SELECT COUNT(*) FROM ParkingSlots WHERE SlotNumber = ?", Integer.class, req.slotNumber
        );
        if (dup != null && dup > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "SlotNumber already exists");
        }

        // Resolve LaneID:
        //  - If client sent one, ensure it exists in the same location AND has the same type.
        //  - Otherwise auto-pick: existing lane in this (location, type), or a new LaneID.
        Integer laneId = req.laneId;
        if (laneId != null) {
            Map<String, Object> existing;
            try {
                existing = jdbc.queryForMap(
                    "SELECT TOP 1 SlotLocation, SlotType FROM ParkingSlots WHERE LaneID = ?",
                    laneId
                );
            } catch (Exception ex) {
                throw new ApiException(HttpStatus.NOT_FOUND, "Lane not found");
            }
            if (!req.slotLocation.equals(existing.get("SlotLocation"))) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Lane belongs to location '" + existing.get("SlotLocation") + "' — cannot mix locations");
            }
            if (!req.slotType.equals(existing.get("SlotType"))) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Lane is for " + existing.get("SlotType") + " — cannot add a " + req.slotType + " slot");
            }
        } else {
            // Auto-pick lane: same (location,type), else create a new one
            Integer found = jdbc.query(
                "SELECT TOP 1 LaneID FROM ParkingSlots WHERE SlotLocation = ? AND SlotType = ? AND LaneID IS NOT NULL",
                rs -> rs.next() ? rs.getInt(1) : null,
                req.slotLocation, req.slotType
            );
            if (found != null) {
                laneId = found;
            } else {
                Integer maxL = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(LaneID), 0) FROM ParkingSlots", Integer.class
                );
                laneId = (maxL == null ? 0 : maxL) + 1;
            }
        }

        Map<String, Object> values = new HashMap<>();
        values.put("SlotNumber", req.slotNumber);
        values.put("SlotLocation", req.slotLocation);
        values.put("SlotType", req.slotType);
        values.put("Status", req.status == null ? "Available" : req.status);
        values.put("LaneID", laneId);

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("ParkingSlots")
            .usingGeneratedKeyColumns("SlotID")
            .usingColumns("SlotNumber", "SlotLocation", "SlotType", "Status", "LaneID")
            .executeAndReturnKey(values);

        return Map.of("slotId", id.intValue(), "slotNumber", req.slotNumber, "laneId", laneId);
    }

    @PatchMapping("/slots/{id}")
    public Map<String, Object> updateSlot(@PathVariable int id,
                                          @RequestParam int userId,
                                          @RequestBody SlotReq req) {
        assertAdmin(userId);
        if (req.status != null && !List.of("Available", "Occupied", "Reserved", "Maintenance").contains(req.status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid status");
        }
        StringBuilder sql = new StringBuilder("UPDATE ParkingSlots SET ");
        java.util.List<Object> args = new java.util.ArrayList<>();
        java.util.List<String> sets = new java.util.ArrayList<>();
        if (req.slotLocation != null) { sets.add("SlotLocation = ?"); args.add(req.slotLocation); }
        if (req.slotType != null)     { sets.add("SlotType = ?");     args.add(req.slotType); }
        if (req.status != null)       { sets.add("Status = ?");       args.add(req.status); }
        if (sets.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "No fields to update");
        sql.append(String.join(", ", sets)).append(" WHERE SlotID = ?");
        args.add(id);

        int rows = jdbc.update(sql.toString(), args.toArray());
        if (rows == 0) throw new ApiException(HttpStatus.NOT_FOUND, "Slot not found");
        return Map.of("slotId", id, "updated", true);
    }

    public record LaneReq(String slotLocation, String slotType, String prefix, Integer count) {}

    @PostMapping("/slots/bulk")
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> createLane(@RequestParam int userId, @RequestBody LaneReq req) {
        assertAdmin(userId);
        if (req.slotLocation == null || req.slotType == null || req.count == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotLocation, slotType, count required");
        }
        if (!List.of("Car", "Bike", "EBike", "EV").contains(req.slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType must be Car, Bike, EBike or EV");
        }
        if (req.count < 1 || req.count > 30) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "count must be 1-30");
        }
        String prefix = (req.prefix == null || req.prefix.isBlank()) ? "L" : req.prefix.trim();

        // Find the next available numeric suffix for this prefix
        Integer maxN = jdbc.queryForObject(
            "SELECT COALESCE(MAX(TRY_CAST(SUBSTRING(SlotNumber, ?, 10) AS INT)), 0) " +
            "FROM ParkingSlots WHERE SlotNumber LIKE ?",
            Integer.class, prefix.length() + 1, prefix + "%"
        );
        int start = (maxN == null ? 0 : maxN) + 1;

        // New lane gets a fresh LaneID
        Integer maxLane = jdbc.queryForObject(
            "SELECT COALESCE(MAX(LaneID), 0) FROM ParkingSlots", Integer.class
        );
        int newLaneId = (maxLane == null ? 0 : maxLane) + 1;

        SimpleJdbcInsert insert = new SimpleJdbcInsert(jdbc)
            .withTableName("ParkingSlots")
            .usingGeneratedKeyColumns("SlotID")
            .usingColumns("SlotNumber", "SlotLocation", "SlotType", "Status", "LaneID");

        java.util.List<Map<String, Object>> created = new java.util.ArrayList<>();
        for (int i = 0; i < req.count; i++) {
            String num = prefix + (start + i);
            Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ParkingSlots WHERE SlotNumber = ?", Integer.class, num
            );
            if (dup != null && dup > 0) continue;

            Map<String, Object> values = new HashMap<>();
            values.put("SlotNumber", num);
            values.put("SlotLocation", req.slotLocation);
            values.put("SlotType", req.slotType);
            values.put("Status", "Available");
            values.put("LaneID", newLaneId);
            Number id = insert.executeAndReturnKey(values);
            created.add(Map.of("slotId", id.intValue(), "slotNumber", num));
        }
        return Map.of(
            "location", req.slotLocation,
            "type", req.slotType,
            "laneId", newLaneId,
            "createdCount", created.size(),
            "created", created
        );
    }

    @DeleteMapping("/slots/{id}")
    public Map<String, Object> deleteSlot(@PathVariable int id, @RequestParam int userId) {
        assertAdmin(userId);
        Integer active = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Reservations WHERE SlotID = ? AND ReservationStatus = 'Booked'",
            Integer.class, id
        );
        if (active != null && active > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Slot has active reservations");
        }
        int rows = jdbc.update("DELETE FROM ParkingSlots WHERE SlotID = ?", id);
        if (rows == 0) throw new ApiException(HttpStatus.NOT_FOUND, "Slot not found");
        return Map.of("slotId", id, "deleted", true);
    }

    // ───────────── PRICING RULES ─────────────
    public record PricingReq(String slotType, BigDecimal pricePerHour, String effectiveFrom) {}

    @GetMapping("/pricing")
    public List<Map<String, Object>> allPricing(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT PricingID, SlotType, PricePerHour, EffectiveFrom FROM PricingRules ORDER BY EffectiveFrom DESC",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("pricingId", rs.getInt("PricingID"));
                m.put("type", rs.getString("SlotType"));
                m.put("pricePerHour", rs.getBigDecimal("PricePerHour"));
                m.put("effectiveFrom", rs.getDate("EffectiveFrom").toString());
                return m;
            }
        );
    }

    @PostMapping("/pricing")
    public Map<String, Object> createPricing(@RequestParam int userId, @RequestBody PricingReq req) {
        assertAdmin(userId);
        if (req.slotType == null || req.pricePerHour == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType and pricePerHour required");
        }
        if (!List.of("Car", "Bike", "EBike", "EV").contains(req.slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType must be Car, Bike, EBike or EV");
        }
        if (req.pricePerHour.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "pricePerHour must be > 0");
        }

        LocalDate eff = req.effectiveFrom == null ? LocalDate.now() : LocalDate.parse(req.effectiveFrom);

        Map<String, Object> values = new HashMap<>();
        values.put("SlotType", req.slotType);
        values.put("PricePerHour", req.pricePerHour);
        values.put("EffectiveFrom", java.sql.Date.valueOf(eff));

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("PricingRules")
            .usingGeneratedKeyColumns("PricingID")
            .executeAndReturnKey(values);

        return Map.of("pricingId", id.intValue(), "type", req.slotType, "pricePerHour", req.pricePerHour);
    }

    @DeleteMapping("/pricing/{id}")
    public Map<String, Object> deletePricing(@PathVariable int id, @RequestParam int userId) {
        assertAdmin(userId);
        int rows = jdbc.update("DELETE FROM PricingRules WHERE PricingID = ?", id);
        if (rows == 0) throw new ApiException(HttpStatus.NOT_FOUND, "Pricing rule not found");
        return Map.of("pricingId", id, "deleted", true);
    }

    // ───────────── PEAK HOURS (DYNAMIC PRICING) ─────────────
    public record PeakHourReq(Integer startHour, Integer endHour, BigDecimal multiplier, String label) {}

    @GetMapping("/peak-hours")
    public List<Map<String, Object>> listPeakHours(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT PeakHourID, StartHour, EndHour, Multiplier, Label FROM PeakHours ORDER BY StartHour",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("peakHourId", rs.getInt("PeakHourID"));
                m.put("startHour", rs.getInt("StartHour"));
                m.put("endHour", rs.getInt("EndHour"));
                m.put("multiplier", rs.getBigDecimal("Multiplier"));
                m.put("label", rs.getString("Label"));
                return m;
            }
        );
    }

    @PostMapping("/peak-hours")
    public Map<String, Object> createPeakHour(@RequestParam int userId, @RequestBody PeakHourReq req) {
        assertAdmin(userId);
        if (req.startHour == null || req.endHour == null || req.multiplier == null || req.label == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "startHour, endHour, multiplier, label required");
        }
        if (req.startHour < 0 || req.startHour > 23) throw new ApiException(HttpStatus.BAD_REQUEST, "startHour must be 0-23");
        if (req.endHour < 1 || req.endHour > 24)     throw new ApiException(HttpStatus.BAD_REQUEST, "endHour must be 1-24");
        if (req.endHour <= req.startHour)            throw new ApiException(HttpStatus.BAD_REQUEST, "endHour must be > startHour");
        if (req.multiplier.signum() <= 0)            throw new ApiException(HttpStatus.BAD_REQUEST, "multiplier must be > 0");

        Map<String, Object> values = new HashMap<>();
        values.put("StartHour", req.startHour);
        values.put("EndHour", req.endHour);
        values.put("Multiplier", req.multiplier);
        values.put("Label", req.label);

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("PeakHours")
            .usingGeneratedKeyColumns("PeakHourID")
            .executeAndReturnKey(values);

        return Map.of("peakHourId", id.intValue(), "label", req.label);
    }

    @DeleteMapping("/peak-hours/{id}")
    public Map<String, Object> deletePeakHour(@PathVariable int id, @RequestParam int userId) {
        assertAdmin(userId);
        int rows = jdbc.update("DELETE FROM PeakHours WHERE PeakHourID = ?", id);
        if (rows == 0) throw new ApiException(HttpStatus.NOT_FOUND, "Peak hour rule not found");
        return Map.of("peakHourId", id, "deleted", true);
    }

    // ───────────── REPORTS ─────────────
    @GetMapping("/reports/revenue-by-location")
    public List<Map<String, Object>> revenueByLocation(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT SlotLocation, Reservations, Revenue FROM RevenueByLocation ORDER BY Revenue DESC",
            (rs, i) -> Map.of(
                "location", rs.getString("SlotLocation"),
                "reservations", rs.getInt("Reservations"),
                "revenue", rs.getBigDecimal("Revenue")
            )
        );
    }

    @GetMapping("/reports/peak-hours")
    public List<Map<String, Object>> peakHoursReport(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT HourOfDay, Bookings FROM PeakHoursReport ORDER BY HourOfDay",
            (rs, i) -> Map.of(
                "hour", rs.getInt("HourOfDay"),
                "bookings", rs.getInt("Bookings")
            )
        );
    }

    @GetMapping("/reports/top-users")
    public List<Map<String, Object>> topUsers(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT UserID, FullName, Email, TotalReservations, TotalSpent FROM TopUsers",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("userId", rs.getInt("UserID"));
                m.put("fullName", rs.getString("FullName"));
                m.put("email", rs.getString("Email"));
                m.put("totalReservations", rs.getInt("TotalReservations"));
                m.put("totalSpent", rs.getBigDecimal("TotalSpent"));
                return m;
            }
        );
    }

    // ───────────── ADMIN FORCE-CANCEL ─────────────
    @PatchMapping("/reservations/{id}/cancel")
    public Map<String, Object> forceCancel(@PathVariable int id, @RequestParam int userId) {
        assertAdmin(userId);
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                "SELECT ReservationStatus FROM Reservations WHERE ReservationID = ?",
                id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        String status = (String) row.get("ReservationStatus");
        if (!"Booked".equals(status)) {
            throw new ApiException(HttpStatus.CONFLICT,
                "Only active reservations can be cancelled (current: " + status + ")");
        }
        // trigger trg_Reservation_StatusChange will free the slot
        jdbc.update("UPDATE Reservations SET ReservationStatus = 'Cancelled' WHERE ReservationID = ?", id);
        return Map.of("reservationId", id, "status", "Cancelled", "forcedByAdmin", true);
    }

    // ───────────── EXTENSION REQUESTS (ADMIN) ─────────────
    public record ExtensionResolveReq(String adminNote) {}

    @GetMapping("/extensions")
    public List<Map<String, Object>> listExtensions(@RequestParam int userId,
                                                    @RequestParam(required = false) String status) {
        assertAdmin(userId);
        StringBuilder sql = new StringBuilder("""
            SELECT ExtensionRequestID, ReservationID, RequestedEndTime, UserNote, Status, AdminNote,
                   CreatedAt, ResolvedAt, UserID, ReservationStart, ReservationEnd, ReservationStatus,
                   CheckInTime, UserName, UserEmail, SlotID, SlotNumber, SlotLocation, SlotType
            FROM ExtensionRequestDetails
            WHERE 1=1
        """);
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (status != null) { sql.append(" AND Status = ?"); args.add(status); }
        sql.append(" ORDER BY CASE WHEN Status = 'Pending' THEN 0 ELSE 1 END, CreatedAt DESC");

        return jdbc.query(sql.toString(), (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("extensionRequestId", rs.getInt("ExtensionRequestID"));
            m.put("reservationId", rs.getInt("ReservationID"));
            m.put("requestedEndTime", rs.getTimestamp("RequestedEndTime").toLocalDateTime().toString());
            m.put("userNote", rs.getString("UserNote"));
            m.put("status", rs.getString("Status"));
            m.put("adminNote", rs.getString("AdminNote"));
            m.put("createdAt", rs.getTimestamp("CreatedAt").toLocalDateTime().toString());
            java.sql.Timestamp ra = rs.getTimestamp("ResolvedAt");
            m.put("resolvedAt", ra == null ? null : ra.toLocalDateTime().toString());
            m.put("userName", rs.getString("UserName"));
            m.put("userEmail", rs.getString("UserEmail"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            m.put("location", rs.getString("SlotLocation"));
            m.put("slotType", rs.getString("SlotType"));
            m.put("reservationStart", rs.getTimestamp("ReservationStart").toLocalDateTime().toString());
            m.put("reservationEnd", rs.getTimestamp("ReservationEnd").toLocalDateTime().toString());
            m.put("reservationStatus", rs.getString("ReservationStatus"));
            return m;
        }, args.toArray());
    }

    @PostMapping("/extensions/{id}/approve")
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> approveExtension(@PathVariable int id,
                                                @RequestParam int userId,
                                                @RequestBody(required = false) ExtensionResolveReq req) {
        assertAdmin(userId);
        Map<String, Object> ext;
        try {
            ext = jdbc.queryForMap(
                "SELECT er.Status, er.RequestedEndTime, er.ReservationID, " +
                "       r.SlotID, r.EndTime AS CurrentEnd, r.ReservationStatus " +
                "FROM ExtensionRequests er JOIN Reservations r ON er.ReservationID = r.ReservationID " +
                "WHERE er.ExtensionRequestID = ?",
                id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Extension request not found");
        }
        if (!"Pending".equals(ext.get("Status")))
            throw new ApiException(HttpStatus.CONFLICT, "Already resolved");
        if (!"Booked".equals(ext.get("ReservationStatus")))
            throw new ApiException(HttpStatus.CONFLICT, "Reservation is no longer active");

        java.sql.Timestamp newEnd = (java.sql.Timestamp) ext.get("RequestedEndTime");
        java.sql.Timestamp curEnd = (java.sql.Timestamp) ext.get("CurrentEnd");
        Integer slotId = (Integer) ext.get("SlotID");
        Integer reservationId = (Integer) ext.get("ReservationID");

        if (!newEnd.after(curEnd))
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Requested end time is not after current end time");

        // Conflict check: any other Booked reservation on this slot that overlaps the new window
        Integer conflicts = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Reservations " +
            "WHERE SlotID = ? AND ReservationID <> ? AND ReservationStatus = 'Booked' " +
            "AND StartTime < ? AND EndTime > ?",
            Integer.class, slotId, reservationId, newEnd, curEnd
        );
        if (conflicts != null && conflicts > 0)
            throw new ApiException(HttpStatus.CONFLICT,
                "Cannot extend — another booking exists on this slot in that window");

        jdbc.update(
            "UPDATE Reservations SET EndTime = ? WHERE ReservationID = ?",
            newEnd, reservationId
        );
        String note = req == null ? null : req.adminNote;
        jdbc.update(
            "UPDATE ExtensionRequests " +
            "SET Status='Approved', AdminNote=?, ResolvedAt=GETDATE(), ResolvedBy=? " +
            "WHERE ExtensionRequestID=?",
            note, userId, id
        );
        return Map.of("extensionRequestId", id, "status", "Approved",
                      "newEndTime", newEnd.toLocalDateTime().toString());
    }

    @PostMapping("/extensions/{id}/deny")
    public Map<String, Object> denyExtension(@PathVariable int id,
                                             @RequestParam int userId,
                                             @RequestBody(required = false) ExtensionResolveReq req) {
        assertAdmin(userId);
        String currentStatus;
        try {
            currentStatus = jdbc.queryForObject(
                "SELECT Status FROM ExtensionRequests WHERE ExtensionRequestID = ?",
                String.class, id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Extension request not found");
        }
        if (!"Pending".equals(currentStatus))
            throw new ApiException(HttpStatus.CONFLICT, "Already resolved");

        String note = req == null ? null : req.adminNote;
        jdbc.update(
            "UPDATE ExtensionRequests " +
            "SET Status='Denied', AdminNote=?, ResolvedAt=GETDATE(), ResolvedBy=? " +
            "WHERE ExtensionRequestID=?",
            note, userId, id
        );
        return Map.of("extensionRequestId", id, "status", "Denied");
    }

    // ───────────── ALL RESERVATIONS / PAYMENTS ─────────────
    @GetMapping("/reservations")
    public List<Map<String, Object>> allReservations(@RequestParam int userId) {
        assertAdmin(userId);
        String sql = """
            SELECT r.ReservationID, r.StartTime, r.EndTime, r.ReservationStatus, r.VerificationCode,
                   r.CheckInTime, r.CheckOutTime, r.FinalAmount,
                   u.FullName, u.Email,
                   v.LicensePlate,
                   s.SlotNumber, s.SlotLocation, s.SlotType
            FROM Reservations r
            JOIN Users u ON r.UserID = u.UserID
            JOIN Vehicles v ON r.VehicleID = v.VehicleID
            JOIN ParkingSlots s ON r.SlotID = s.SlotID
            ORDER BY r.StartTime DESC
        """;
        return jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("reservationId", rs.getInt("ReservationID"));
            m.put("startTime", rs.getTimestamp("StartTime").toLocalDateTime().toString());
            m.put("endTime", rs.getTimestamp("EndTime").toLocalDateTime().toString());
            m.put("status", rs.getString("ReservationStatus"));
            m.put("verificationCode", rs.getString("VerificationCode"));
            java.sql.Timestamp ci = rs.getTimestamp("CheckInTime");
            java.sql.Timestamp co = rs.getTimestamp("CheckOutTime");
            m.put("checkInTime",  ci == null ? null : ci.toLocalDateTime().toString());
            m.put("checkOutTime", co == null ? null : co.toLocalDateTime().toString());
            m.put("finalAmount", rs.getBigDecimal("FinalAmount"));
            m.put("userName", rs.getString("FullName"));
            m.put("userEmail", rs.getString("Email"));
            m.put("licensePlate", rs.getString("LicensePlate"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            m.put("location", rs.getString("SlotLocation"));
            m.put("slotType", rs.getString("SlotType"));
            return m;
        });
    }

    @GetMapping("/users")
    public List<Map<String, Object>> allUsers(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT UserID, FullName, Email, Phone, UserRole, RegistrationDate FROM Users ORDER BY RegistrationDate DESC",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("userId", rs.getInt("UserID"));
                m.put("fullName", rs.getString("FullName"));
                m.put("email", rs.getString("Email"));
                m.put("phone", rs.getString("Phone"));
                m.put("role", rs.getString("UserRole"));
                java.sql.Date rd = rs.getDate("RegistrationDate");
                m.put("registrationDate", rd == null ? null : rd.toString());
                return m;
            }
        );
    }

    @GetMapping("/payments")
    public List<Map<String, Object>> allPayments(@RequestParam int userId) {
        assertAdmin(userId);
        return jdbc.query(
            "SELECT * FROM PaymentHistory ORDER BY PaymentDate DESC",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("paymentId", rs.getInt("PaymentID"));
                m.put("userName", rs.getString("FullName"));
                m.put("amount", rs.getBigDecimal("Amount"));
                m.put("method", rs.getString("PaymentMethod"));
                java.sql.Timestamp pd = rs.getTimestamp("PaymentDate");
                m.put("date", pd == null ? null : pd.toLocalDateTime().toString());
                m.put("status", rs.getString("PaymentStatus"));
                return m;
            }
        );
    }
}
