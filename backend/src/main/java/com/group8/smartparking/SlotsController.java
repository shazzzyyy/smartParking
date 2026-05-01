package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/slots")
public class SlotsController {

    private final JdbcTemplate jdbc;

    public SlotsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String location,
                                          @RequestParam(required = false) String type) {
        StringBuilder sql = new StringBuilder("""
            SELECT s.SlotID, s.SlotNumber, s.SlotLocation, s.SlotType, s.Status, s.LaneID,
                   (
                     SELECT TOP 1 r.EndTime
                     FROM   Reservations r
                     WHERE  r.SlotID = s.SlotID
                       AND  r.ReservationStatus = 'Booked'
                       AND  r.EndTime > GETDATE()
                     ORDER BY
                       CASE WHEN r.StartTime <= GETDATE() THEN 0 ELSE 1 END,
                       r.StartTime
                   ) AS FreeAt
            FROM ParkingSlots s
            WHERE 1=1
        """);
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (location != null) { sql.append(" AND s.SlotLocation = ?"); args.add(location); }
        if (type != null)     { sql.append(" AND s.SlotType = ?");     args.add(type); }
        sql.append(" ORDER BY s.SlotNumber");

        return jdbc.query(sql.toString(), (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("slotId", rs.getInt("SlotID"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            m.put("location", rs.getString("SlotLocation"));
            m.put("type", rs.getString("SlotType"));
            m.put("status", rs.getString("Status"));
            int lane = rs.getInt("LaneID");
            m.put("laneId", rs.wasNull() ? null : lane);
            java.sql.Timestamp ft = rs.getTimestamp("FreeAt");
            m.put("freeAt", ft == null ? null : ft.toLocalDateTime().toString());
            return m;
        }, args.toArray());
    }

    @GetMapping("/locations")
    public List<String> locations() {
        return jdbc.queryForList(
            "SELECT DISTINCT SlotLocation FROM ParkingSlots ORDER BY SlotLocation",
            String.class
        );
    }

    @GetMapping("/pricing")
    public List<Map<String, Object>> pricing() {
        return jdbc.query(
            "SELECT SlotType, PricePerHour FROM PricingRules ORDER BY EffectiveFrom DESC",
            (rs, i) -> Map.of(
                "type", rs.getString("SlotType"),
                "pricePerHour", rs.getBigDecimal("PricePerHour")
            )
        );
    }

    @GetMapping("/peak-hours")
    public List<Map<String, Object>> peakHours() {
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

    @GetMapping("/quote")
    public Map<String, Object> quote(@RequestParam String slotType,
                                     @RequestParam String start,
                                     @RequestParam String end) {
        if (!List.of("Car", "Bike", "EBike", "EV").contains(slotType)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid slotType");
        }
        LocalDateTime s = LocalDateTime.parse(start);
        LocalDateTime e = LocalDateTime.parse(end);
        if (!e.isAfter(s)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "end must be after start");
        }

        BigDecimal flatRate = jdbc.queryForObject(
            "SELECT TOP 1 PricePerHour FROM PricingRules WHERE SlotType = ? ORDER BY EffectiveFrom DESC",
            BigDecimal.class, slotType
        );

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
            "Start",    Timestamp.valueOf(s),
            "End",      Timestamp.valueOf(e)
        ));
        BigDecimal dynamicTotal = (BigDecimal) out.get("Total");
        if (dynamicTotal == null) dynamicTotal = BigDecimal.ZERO;

        double hours = java.time.Duration.between(s, e).toMinutes() / 60.0;
        BigDecimal flatTotal = flatRate == null
            ? BigDecimal.ZERO
            : flatRate.multiply(BigDecimal.valueOf(hours)).setScale(2, java.math.RoundingMode.HALF_UP);

        Map<String, Object> result = new HashMap<>();
        result.put("slotType", slotType);
        result.put("hours", Math.round(hours * 100.0) / 100.0);
        result.put("baseRate", flatRate);
        result.put("flatTotal", flatTotal);
        result.put("dynamicTotal", dynamicTotal);
        result.put("multiplierApplied",
            flatTotal.signum() == 0 ? BigDecimal.ONE
                : dynamicTotal.divide(flatTotal, 3, java.math.RoundingMode.HALF_UP));
        return result;
    }
}
