package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentsController {

    private final JdbcTemplate jdbc;

    public PaymentsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record PayReq(Integer reservationId, BigDecimal amount, String paymentMethod) {}

    @PostMapping
    public Map<String, Object> pay(@RequestBody PayReq req) {
        if (req.reservationId == null || req.amount == null || req.paymentMethod == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId, amount, paymentMethod required");
        }
        if (!List.of("Cash", "Card", "Online").contains(req.paymentMethod)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "paymentMethod must be Cash, Card or Online");
        }

        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Payments WHERE ReservationID = ? AND PaymentStatus = 'Paid'",
            Integer.class, req.reservationId
        );
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation already paid");
        }

        Map<String, Object> values = new HashMap<>();
        values.put("ReservationID", req.reservationId);
        values.put("Amount", req.amount);
        values.put("PaymentMethod", req.paymentMethod);
        values.put("PaymentStatus", "Paid");

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("Payments")
            .usingGeneratedKeyColumns("PaymentID")
            .executeAndReturnKey(values);

        return Map.of(
            "paymentId", id.intValue(),
            "reservationId", req.reservationId,
            "amount", req.amount,
            "method", req.paymentMethod,
            "status", "Paid"
        );
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@RequestParam int userId) {
        String sql = """
            SELECT p.PaymentID, p.Amount, p.PaymentMethod, p.PaymentStatus, p.PaymentDate,
                   r.ReservationID, s.SlotNumber
            FROM Payments p
            JOIN Reservations r ON p.ReservationID = r.ReservationID
            JOIN ParkingSlots s ON r.SlotID = s.SlotID
            WHERE r.UserID = ?
            ORDER BY p.PaymentDate DESC
        """;
        return jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("paymentId", rs.getInt("PaymentID"));
            m.put("amount", rs.getBigDecimal("Amount"));
            m.put("method", rs.getString("PaymentMethod"));
            m.put("status", rs.getString("PaymentStatus"));
            m.put("date", rs.getTimestamp("PaymentDate").toLocalDateTime().toString());
            m.put("reservationId", rs.getInt("ReservationID"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            return m;
        }, userId);
    }
}
