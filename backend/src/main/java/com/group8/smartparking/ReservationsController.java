package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.sql.Types;
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
    public record CheckInReq(String code) {}
    public record ExtensionReq(Integer userId, String requestedEndTime, String userNote) {}

    private String code() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
        return sb.toString();
    }

    private BigDecimal calculatePrice(String slotType, LocalDateTime start, LocalDateTime end) {
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
            "SlotType", slotType,
            "Start",    Timestamp.valueOf(start),
            "End",      Timestamp.valueOf(end)
        ));
        Object total = out.get("Total");
        return total == null ? BigDecimal.ZERO : (BigDecimal) total;
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

        Map<String, Object> vehicle;
        try {
            vehicle = jdbc.queryForMap(
                "SELECT UserID, VehicleType FROM Vehicles WHERE VehicleID = ?",
                req.vehicleId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND,
                "Vehicle not found. Register a vehicle before booking.");
        }
        Integer ownerId = (Integer) vehicle.get("UserID");
        String vehicleType = (String) vehicle.get("VehicleType");
        if (ownerId == null || !ownerId.equals(req.userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                "This vehicle does not belong to you.");
        }
        if (!vehicleType.equals(slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Vehicle type (" + vehicleType + ") does not match slot type (" + slotType + ").");
        }

        Integer activeForVehicle = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Reservations " +
            "WHERE VehicleID = ? AND ReservationStatus = 'Booked' " +
            "AND EndTime > ?",
            Integer.class, req.vehicleId, Timestamp.valueOf(LocalDateTime.now())
        );
        if (activeForVehicle != null && activeForVehicle > 0) {
            throw new ApiException(HttpStatus.CONFLICT,
                "This vehicle already has an active reservation. " +
                "Wait until it ends or cancel it before booking another slot.");
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

        BigDecimal total = calculatePrice(slotType, start, end);

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
                   r.CheckInTime, r.CheckOutTime, r.FinalAmount,
                   s.SlotID, s.SlotNumber, s.SlotLocation, s.SlotType,
                   v.LicensePlate,
                   p.PaymentID, p.Amount, p.PaymentMethod, p.PaymentStatus, p.PaymentDate
            FROM Reservations r
            JOIN ParkingSlots s ON r.SlotID = s.SlotID
            JOIN Vehicles v ON r.VehicleID = v.VehicleID
            LEFT JOIN Payments p ON p.ReservationID = r.ReservationID
            WHERE r.UserID = ?
            ORDER BY r.StartTime DESC
        """;
        List<Map<String, Object>> rows = jdbc.query(sql, (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("reservationId", rs.getInt("ReservationID"));
            LocalDateTime st = rs.getTimestamp("StartTime").toLocalDateTime();
            LocalDateTime et = rs.getTimestamp("EndTime").toLocalDateTime();
            m.put("startTime", st.toString());
            m.put("endTime", et.toString());
            m.put("_startTimeRaw", st);
            m.put("_endTimeRaw", et);
            m.put("status", rs.getString("ReservationStatus"));
            m.put("verificationCode", rs.getString("VerificationCode"));
            Timestamp ci = rs.getTimestamp("CheckInTime");
            Timestamp co = rs.getTimestamp("CheckOutTime");
            m.put("checkInTime",  ci == null ? null : ci.toLocalDateTime().toString());
            m.put("checkOutTime", co == null ? null : co.toLocalDateTime().toString());
            m.put("finalAmount", rs.getBigDecimal("FinalAmount"));
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

        // For unpaid reservations, compute the estimated amount via sp_CalculatePrice
        // so the front-end can show / submit the right value at payment time.
        for (Map<String, Object> row : rows) {
            if (!"Unpaid".equals(row.get("paymentStatus"))) {
                row.remove("_startTimeRaw");
                row.remove("_endTimeRaw");
                continue;
            }
            String slotType = (String) row.get("slotType");
            LocalDateTime st = (LocalDateTime) row.remove("_startTimeRaw");
            LocalDateTime et = (LocalDateTime) row.remove("_endTimeRaw");
            try {
                BigDecimal estimate = calculatePrice(slotType, st, et);
                row.put("amount", estimate);
            } catch (Exception ex) {
                row.put("amount", BigDecimal.ZERO);
            }
        }
        return rows;
    }

    @PatchMapping("/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable int id, @RequestParam int userId) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                "SELECT SlotID, StartTime, CheckInTime FROM Reservations " +
                "WHERE ReservationID = ? AND UserID = ? AND ReservationStatus = 'Booked'",
                id, userId
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found or not cancellable");
        }

        Timestamp startTs = (Timestamp) row.get("StartTime");
        Object checkIn = row.get("CheckInTime");
        if (checkIn != null) {
            throw new ApiException(HttpStatus.CONFLICT,
                "Already checked in — use check-out instead of cancel.");
        }

        long minutesUntilStart =
            java.time.Duration.between(LocalDateTime.now(), startTs.toLocalDateTime()).toMinutes();
        if (minutesUntilStart < 60) {
            throw new ApiException(HttpStatus.CONFLICT,
                "Cancellation closed: must cancel at least 1 hour before start time " +
                "(only " + Math.max(minutesUntilStart, 0) + " minutes left).");
        }

        // trigger trg_Reservation_StatusChange will free the slot
        jdbc.update("UPDATE Reservations SET ReservationStatus = 'Cancelled' WHERE ReservationID = ?", id);
        return Map.of("reservationId", id, "status", "Cancelled");
    }

    @PostMapping("/checkin")
    public Map<String, Object> checkIn(@RequestBody CheckInReq req) {
        if (req.code == null || req.code.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Verification code required");
        }
        SimpleJdbcCall call = new SimpleJdbcCall(jdbc)
            .withProcedureName("sp_CheckIn")
            .withoutProcedureColumnMetaDataAccess()
            .declareParameters(
                new SqlParameter("VerificationCode", Types.VARCHAR),
                new SqlOutParameter("ReservationID",  Types.INTEGER),
                new SqlOutParameter("SlotNumber",     Types.VARCHAR),
                new SqlOutParameter("UserName",       Types.VARCHAR)
            );
        Map<String, Object> out;
        try {
            out = call.execute(Map.of("VerificationCode", req.code.trim().toUpperCase()));
        } catch (org.springframework.jdbc.UncategorizedSQLException ex) {
            String msg = ex.getMostSpecificCause().getMessage();
            throw new ApiException(HttpStatus.BAD_REQUEST,
                msg == null ? "Check-in failed" : msg);
        }
        return Map.of(
            "reservationId", out.get("ReservationID"),
            "slotNumber",    out.get("SlotNumber"),
            "userName",      out.get("UserName"),
            "status",        "CheckedIn"
        );
    }

    @PostMapping("/{id}/extensions")
    public Map<String, Object> requestExtension(@PathVariable int id, @RequestBody ExtensionReq req) {
        if (req.userId == null || req.requestedEndTime == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "userId and requestedEndTime required");
        }
        Map<String, Object> reservation;
        try {
            reservation = jdbc.queryForMap(
                "SELECT UserID, EndTime, ReservationStatus FROM Reservations WHERE ReservationID = ?",
                id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        Integer ownerId = (Integer) reservation.get("UserID");
        if (ownerId == null || !ownerId.equals(req.userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your reservation");
        }
        if (!"Booked".equals(reservation.get("ReservationStatus"))) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation is not active");
        }
        Timestamp currentEnd = (Timestamp) reservation.get("EndTime");
        LocalDateTime requested = LocalDateTime.parse(req.requestedEndTime);
        if (!requested.isAfter(currentEnd.toLocalDateTime())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Requested end time must be after current end time");
        }

        Integer pending = jdbc.queryForObject(
            "SELECT COUNT(*) FROM ExtensionRequests WHERE ReservationID = ? AND Status = 'Pending'",
            Integer.class, id
        );
        if (pending != null && pending > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "An extension request is already pending");
        }

        Map<String, Object> values = new HashMap<>();
        values.put("ReservationID", id);
        values.put("RequestedEndTime", Timestamp.valueOf(requested));
        values.put("UserNote", req.userNote);
        values.put("Status", "Pending");
        values.put("CreatedAt", Timestamp.valueOf(LocalDateTime.now()));

        Number extId = new SimpleJdbcInsert(jdbc)
            .withTableName("ExtensionRequests")
            .usingGeneratedKeyColumns("ExtensionRequestID")
            .usingColumns("ReservationID", "RequestedEndTime", "UserNote", "Status", "CreatedAt")
            .executeAndReturnKey(values);

        return Map.of(
            "extensionRequestId", extId.intValue(),
            "reservationId", id,
            "requestedEndTime", requested.toString(),
            "status", "Pending"
        );
    }

    @GetMapping("/{id}/extensions")
    public List<Map<String, Object>> myExtensions(@PathVariable int id, @RequestParam int userId) {
        Integer owner;
        try {
            owner = jdbc.queryForObject(
                "SELECT UserID FROM Reservations WHERE ReservationID = ?",
                Integer.class, id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        if (owner == null || owner != userId) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your reservation");
        }
        return jdbc.query(
            "SELECT ExtensionRequestID, RequestedEndTime, UserNote, Status, AdminNote, CreatedAt, ResolvedAt " +
            "FROM ExtensionRequests WHERE ReservationID = ? ORDER BY CreatedAt DESC",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("extensionRequestId", rs.getInt("ExtensionRequestID"));
                m.put("requestedEndTime", rs.getTimestamp("RequestedEndTime").toLocalDateTime().toString());
                m.put("userNote", rs.getString("UserNote"));
                m.put("status", rs.getString("Status"));
                m.put("adminNote", rs.getString("AdminNote"));
                m.put("createdAt", rs.getTimestamp("CreatedAt").toLocalDateTime().toString());
                Timestamp ra = rs.getTimestamp("ResolvedAt");
                m.put("resolvedAt", ra == null ? null : ra.toLocalDateTime().toString());
                return m;
            }, id
        );
    }

    @PostMapping("/{id}/checkout")
    public Map<String, Object> checkOut(@PathVariable int id, @RequestParam int userId) {
        // Verify ownership (the proc itself doesn't check user)
        Integer owner;
        try {
            owner = jdbc.queryForObject(
                "SELECT UserID FROM Reservations WHERE ReservationID = ?",
                Integer.class, id
            );
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        if (owner == null || owner != userId) {
            // Allow Admin to check out anyone too
            String role = jdbc.queryForObject(
                "SELECT UserRole FROM Users WHERE UserID = ?", String.class, userId
            );
            if (!"Admin".equals(role)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Not your reservation");
            }
        }

        SimpleJdbcCall call = new SimpleJdbcCall(jdbc)
            .withProcedureName("sp_CheckOut")
            .withoutProcedureColumnMetaDataAccess()
            .declareParameters(
                new SqlParameter("ReservationID", Types.INTEGER),
                new SqlOutParameter("FinalAmount", Types.DECIMAL)
            );
        Map<String, Object> out;
        try {
            out = call.execute(Map.of("ReservationID", id));
        } catch (org.springframework.jdbc.UncategorizedSQLException ex) {
            String msg = ex.getMostSpecificCause().getMessage();
            throw new ApiException(HttpStatus.BAD_REQUEST,
                msg == null ? "Check-out failed" : msg);
        }
        return Map.of(
            "reservationId", id,
            "finalAmount",   out.get("FinalAmount"),
            "status",        "Completed"
        );
    }
}
