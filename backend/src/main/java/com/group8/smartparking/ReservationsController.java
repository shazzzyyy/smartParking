package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
public class ReservationsController {

    private final JdbcTemplate jdbc;
    private static final SecureRandom RNG = new SecureRandom();
    private static final String ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public ReservationsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record CreateReq(Integer userId, Integer vehicleId, Integer slotId,
                             String startTime, String endTime) {}

    private String code() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
        return sb.toString();
    }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody CreateReq req) {
        if (req.userId == null || req.vehicleId == null || req.slotId == null
            || req.startTime == null || req.endTime == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing required fields");
        }

        LocalDateTime start = LocalDateTime.parse(req.startTime);
        LocalDateTime end = LocalDateTime.parse(req.endTime);
        if (!end.isAfter(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EndTime must be after StartTime");
        }

        Map<String, Object> slot;
        try {
            slot = jdbc.queryForMap(
                "SELECT Status, SlotType FROM ParkingSlots WHERE SlotID = ?",
                req.slotId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Slot not found");
        }
        String status = (String) slot.get("Status");
        String slotType = (String) slot.get("SlotType");
        if (!"Available".equals(status)) {
            throw new ApiException(HttpStatus.CONFLICT, "Slot not available (status: " + status + ")");
        }

        String vCode = code();

        Map<String, Object> values = new HashMap<>();
        values.put("UserID", req.userId);
        values.put("VehicleID", req.vehicleId);
        values.put("SlotID", req.slotId);
        values.put("StartTime", Timestamp.valueOf(start));
        values.put("EndTime", Timestamp.valueOf(end));
        values.put("VerificationCode", vCode);
        values.put("ReservationStatus", "Booked");

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("Reservations")
            .usingGeneratedKeyColumns("ReservationID")
            .executeAndReturnKey(values);

        jdbc.update("UPDATE ParkingSlots SET Status = 'Reserved' WHERE SlotID = ?", req.slotId);

        BigDecimal rate = jdbc.queryForObject(
            "SELECT TOP 1 PricePerHour FROM PricingRules WHERE SlotType = ? ORDER BY EffectiveFrom DESC",
            BigDecimal.class, slotType
        );
        double hours = java.time.Duration.between(start, end).toMinutes() / 60.0;
        BigDecimal total = rate == null
            ? BigDecimal.ZERO
            : rate.multiply(BigDecimal.valueOf(hours)).setScale(2, java.math.RoundingMode.HALF_UP);

        return Map.of(
            "reservationId", id.intValue(),
            "verificationCode", vCode,
            "amount", total,
            "status", "Booked"
        );
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@RequestParam int userId) {
        String sql = """
            SELECT r.ReservationID, r.StartTime, r.EndTime, r.ReservationStatus, r.VerificationCode,
                   s.SlotNumber, s.SlotLocation, s.SlotType,
                   v.LicensePlate,
                   p.PaymentID, p.Amount, p.PaymentMethod, p.PaymentStatus, p.PaymentDate
            FROM Reservations r
            JOIN ParkingSlots s ON r.SlotID = s.SlotID
            JOIN Vehicles v ON r.VehicleID = v.VehicleID
            LEFT JOIN Payments p ON p.ReservationID = r.ReservationID
            WHERE r.UserID = ?
            ORDER BY r.StartTime DESC
        """;
        return jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("reservationId", rs.getInt("ReservationID"));
            m.put("startTime", rs.getTimestamp("StartTime").toLocalDateTime().toString());
            m.put("endTime", rs.getTimestamp("EndTime").toLocalDateTime().toString());
            m.put("status", rs.getString("ReservationStatus"));
            m.put("verificationCode", rs.getString("VerificationCode"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            m.put("location", rs.getString("SlotLocation"));
            m.put("slotType", rs.getString("SlotType"));
            m.put("licensePlate", rs.getString("LicensePlate"));
            int pid = rs.getInt("PaymentID");
            if (!rs.wasNull()) {
                m.put("paymentId", pid);
                m.put("amount", rs.getBigDecimal("Amount"));
                m.put("paymentMethod", rs.getString("PaymentMethod"));
                m.put("paymentStatus", rs.getString("PaymentStatus"));
            } else {
                m.put("paymentStatus", "Unpaid");
            }
            return m;
        }, userId);
    }

    @PatchMapping("/{id}/cancel")
    @Transactional
    public Map<String, Object> cancel(@PathVariable int id, @RequestParam int userId) {
        Integer slotId;
        try {
            slotId = jdbc.queryForObject(
                "SELECT SlotID FROM Reservations WHERE ReservationID = ? AND UserID = ? AND ReservationStatus = 'Booked'",
                Integer.class, id, userId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found or not cancellable");
        }

        jdbc.update("UPDATE Reservations SET ReservationStatus = 'Cancelled' WHERE ReservationID = ?", id);
        jdbc.update("UPDATE ParkingSlots SET Status = 'Available' WHERE SlotID = ?", slotId);
        return Map.of("reservationId", id, "status", "Cancelled");
    }
}
