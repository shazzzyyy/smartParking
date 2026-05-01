package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
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
        if (req.reservationId == null || req.paymentMethod == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId and paymentMethod required");
        }
        if (!List.of("Cash", "Card", "Online").contains(req.paymentMethod)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "paymentMethod must be Cash, Card or Online");
        }

        // Authoritative amount = recomputed server-side via sp_CalculatePrice.
        Map<String, Object> reservation;
        try {
            reservation = jdbc.queryForMap(
                "SELECT r.StartTime, r.EndTime, s.SlotType " +
                "FROM Reservations r JOIN ParkingSlots s ON r.SlotID = s.SlotID " +
                "WHERE r.ReservationID = ?",
                req.reservationId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }

        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Payments WHERE ReservationID = ? AND PaymentStatus = 'Paid'",
            Integer.class, req.reservationId
        );
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation already paid");
        }

        Timestamp start = (Timestamp) reservation.get("StartTime");
        Timestamp end   = (Timestamp) reservation.get("EndTime");
        String slotType = (String)    reservation.get("SlotType");

        SimpleJdbcCall call = new SimpleJdbcCall(jdbc)
            .withProcedureName("sp_CalculatePrice")
            .withoutProcedureColumnMetaDataAccess()
            .declareParameters(
                new SqlParameter("SlotType", Types.VARCHAR),
                new SqlParameter("Start",    Types.TIMESTAMP),
                new SqlParameter("End",      Types.TIMESTAMP),
                new SqlOutParameter("Total", Types.DECIMAL)
            );
        Map<String, Object> out = call.execute(Map.of(
            "SlotType", slotType, "Start", start, "End", end
        ));
        BigDecimal amount = (BigDecimal) out.get("Total");
        if (amount == null || amount.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Computed amount is zero — cannot charge. Check pricing rules and reservation window.");
        }

        Map<String, Object> values = new HashMap<>();
        values.put("ReservationID", req.reservationId);
        values.put("Amount", amount);
        values.put("PaymentMethod", req.paymentMethod);
        values.put("PaymentStatus", "Paid");
        values.put("PaymentDate", new Timestamp(System.currentTimeMillis()));

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("Payments")
            .usingGeneratedKeyColumns("PaymentID")
            .usingColumns("ReservationID", "Amount", "PaymentMethod", "PaymentStatus", "PaymentDate")
            .executeAndReturnKey(values);

        return Map.of(
            "paymentId", id.intValue(),
            "reservationId", req.reservationId,
            "amount", amount,
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
            Timestamp pd = rs.getTimestamp("PaymentDate");
            m.put("date", pd == null ? null : pd.toLocalDateTime().toString());
            m.put("reservationId", rs.getInt("ReservationID"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            return m;
        }, userId);
    }
}
