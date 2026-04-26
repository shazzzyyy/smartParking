package com.group8.smartparking;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

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
        StringBuilder sql = new StringBuilder(
            "SELECT SlotID, SlotNumber, SlotLocation, SlotType, Status FROM ParkingSlots WHERE 1=1"
        );
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (location != null) { sql.append(" AND SlotLocation = ?"); args.add(location); }
        if (type != null) { sql.append(" AND SlotType = ?"); args.add(type); }
        sql.append(" ORDER BY SlotNumber");

        return jdbc.query(sql.toString(), (rs, i) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("slotId", rs.getInt("SlotID"));
            m.put("slotNumber", rs.getString("SlotNumber"));
            m.put("location", rs.getString("SlotLocation"));
            m.put("type", rs.getString("SlotType"));
            m.put("status", rs.getString("Status"));
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
}
