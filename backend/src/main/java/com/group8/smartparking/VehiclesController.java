package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vehicles")
public class VehiclesController {

    private final JdbcTemplate jdbc;

    public VehiclesController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record VehicleReq(Integer userId, String licensePlate, String vehicleType, String brand, String model, String color) {}

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@RequestParam int userId) {
        return jdbc.query(
            "SELECT VehicleID, LicensePlate, VehicleType, Brand, Model, Color FROM Vehicles WHERE UserID = ?",
            (rs, i) -> {
                Map<String, Object> m = new HashMap<>();
                m.put("vehicleId", rs.getInt("VehicleID"));
                m.put("licensePlate", rs.getString("LicensePlate"));
                m.put("type", rs.getString("VehicleType"));
                m.put("brand", rs.getString("Brand"));
                m.put("model", rs.getString("Model"));
                m.put("color", rs.getString("Color"));
                return m;
            },
            userId
        );
    }

    @PostMapping
    public Map<String, Object> add(@RequestBody VehicleReq req) {
        if (req.userId == null || req.licensePlate == null || req.vehicleType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "userId, licensePlate, vehicleType required");
        }
        Map<String, Object> values = new HashMap<>();
        values.put("UserID", req.userId);
        values.put("LicensePlate", req.licensePlate);
        values.put("VehicleType", req.vehicleType);
        values.put("Brand", req.brand);
        values.put("Model", req.model);
        values.put("Color", req.color);

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("Vehicles")
            .usingGeneratedKeyColumns("VehicleID")
            .executeAndReturnKey(values);

        return Map.of(
            "vehicleId", id.intValue(),
            "licensePlate", req.licensePlate,
            "type", req.vehicleType
        );
    }
}
