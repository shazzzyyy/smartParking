package com.group8.smartparking;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate jdbc;

    public AuthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record RegisterReq(String fullName, String email, String password, String phone) {}
    public record LoginReq(String email, String password) {}

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterReq req) {
        if (req.email == null || req.password == null || req.fullName == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "fullName, email, password required");
        }

        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM Users WHERE Email = ?",
            Integer.class, req.email
        );
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
        }

        Number id = new SimpleJdbcInsert(jdbc)
            .withTableName("Users")
            .usingGeneratedKeyColumns("UserID")
            .usingColumns("FullName", "Email", "PasswordHash", "Phone", "UserRole", "RegistrationDate")
            .executeAndReturnKey(Map.of(
                "FullName", req.fullName,
                "Email", req.email,
                "PasswordHash", req.password,
                "Phone", req.phone == null ? "" : req.phone,
                "UserRole", "User",
                "RegistrationDate", new java.sql.Date(System.currentTimeMillis())
            ));

        return Map.of(
            "userId", id.intValue(),
            "fullName", req.fullName,
            "email", req.email,
            "role", "User"
        );
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginReq req) {
        try {
            return jdbc.queryForObject(
                "SELECT UserID, FullName, Email, UserRole FROM Users WHERE Email = ? AND PasswordHash = ?",
                (rs, i) -> Map.of(
                    "userId", rs.getInt("UserID"),
                    "fullName", rs.getString("FullName"),
                    "email", rs.getString("Email"),
                    "role", rs.getString("UserRole")
                ),
                req.email, req.password
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
    }
}
