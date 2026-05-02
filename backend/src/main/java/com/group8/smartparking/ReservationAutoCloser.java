package com.group8.smartparking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlOutParameter;
import org.springframework.jdbc.core.SqlParameter;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.List;
import java.util.Map;

/**
 * Periodically closes out reservations whose booked EndTime has passed.
 * No-shows are billed for the full booked window; people who checked in
 * but didn't check out are billed for max(booked window, actual stay).
 * The trg_Reservation_StatusChange trigger frees the slot in either case.
 */
@Component
public class ReservationAutoCloser {

    private static final Logger log = LoggerFactory.getLogger(ReservationAutoCloser.class);
    private final JdbcTemplate jdbc;

    public ReservationAutoCloser(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelayString = "PT1M", initialDelay = 30_000)
    @Transactional
    public void closeExpiredReservations() {
        List<Map<String, Object>> expired = jdbc.queryForList(
            "SELECT r.ReservationID, r.StartTime, r.EndTime, r.CheckInTime, s.SlotType " +
            "FROM Reservations r JOIN ParkingSlots s ON r.SlotID = s.SlotID " +
            "WHERE r.ReservationStatus = 'Booked' AND r.EndTime < GETDATE()"
        );
        if (expired.isEmpty()) return;

        log.info("Auto-closing {} expired reservation(s)", expired.size());
        Timestamp now = new Timestamp(System.currentTimeMillis());

        for (Map<String, Object> r : expired) {
            int resId = ((Number) r.get("ReservationID")).intValue();
            String slotType = (String) r.get("SlotType");
            Timestamp start = (Timestamp) r.get("StartTime");
            Timestamp end = (Timestamp) r.get("EndTime");
            Timestamp checkIn = (Timestamp) r.get("CheckInTime");

            // Bill the full booked window. If they checked in, billStart is whichever
            // came first (booked start) — overstays already billed by sp_CheckOut path,
            // so here we just charge the booked amount.
            try {
                BigDecimal amount = computePrice(slotType, start, end);
                jdbc.update(
                    "UPDATE Reservations " +
                    "SET CheckOutTime = COALESCE(CheckOutTime, ?), " +
                    "    FinalAmount = COALESCE(FinalAmount, ?), " +
                    "    ReservationStatus = 'Completed' " +
                    "WHERE ReservationID = ?",
                    now, amount, resId
                );
                log.info("Auto-closed reservation #{} (no-show={}, amount={})",
                    resId, checkIn == null, amount);
            } catch (Exception ex) {
                log.warn("Failed to auto-close reservation #{}: {}", resId, ex.getMessage());
            }
        }
    }

    private BigDecimal computePrice(String slotType, Timestamp start, Timestamp end) {
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
        BigDecimal total = (BigDecimal) out.get("Total");
        return total == null ? BigDecimal.ZERO : total;
    }
}
