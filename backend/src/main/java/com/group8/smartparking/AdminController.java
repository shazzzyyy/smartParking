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
    public record SlotReq(String slotNumber, String slotLocation, String slotType, String status) {}

    @PostMapping("/slots")
    public Map<String, Object> createSlot(@RequestParam int userId, @RequestBody SlotReq req) {
        assertAdmin(userId);
        if (req.slotNumber == null || req.slotLocation == null || req.slotType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotNumber, slotLocation, slotType required");
        }
        if (!List.of("Car", "Bike", "EV").contains(req.slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType must be Car, Bike or EV");
        }

        Integer dup = jdbc.queryForObject(
            "SELECT COUNT(*) FROM ParkingSlots WHERE SlotNumber = ?", Integer.class, req.slotNumber
        );
        if (dup != null && dup > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "SlotNumber already exists");
        }

        Map<String, Object> values = new HashMap<>();
        values.put("SlotNumber", req.slotNumber);
        values.put("SlotLocation", req.slotLocation);
        values.put("SlotType", req.slotType);
        values.put("Status", req.status == null ? "Available" : req.status);

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("ParkingSlots")
            .usingGeneratedKeyColumns("SlotID")
            .executeAndReturnKey(values);

        return Map.of("slotId", id.intValue(), "slotNumber", req.slotNumber);
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
        if (!List.of("Car", "Bike", "EV").contains(req.slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "slotType must be Car, Bike or EV");
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

    // ───────────── ALL RESERVATIONS / PAYMENTS ─────────────
    @GetMapping("/reservations")
    public List<Map<String, Object>> allReservations(@RequestParam int userId) {
        assertAdmin(userId);
        String sql = """
            SELECT r.ReservationID, r.StartTime, r.EndTime, r.ReservationStatus, r.VerificationCode,
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
                m.put("registrationDate", rs.getDate("RegistrationDate").toString());
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
                m.put("date", rs.getTimestamp("PaymentDate").toLocalDateTime().toString());
                m.put("status", rs.getString("PaymentStatus"));
                return m;
            }
        );
    }
}
