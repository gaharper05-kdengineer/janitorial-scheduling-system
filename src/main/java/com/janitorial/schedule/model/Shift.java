package com.janitorial.schedule.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

@Entity
@Table(name = "shifts")
public class Shift {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String employeeName;
    private LocalDate shiftDate;
    private String startTime;
    private String endTime;
    private int lunchMinutes;
    private double hours;
    private String shiftType;
    private boolean onCall;

    protected Shift() {
    }

    public Shift(String employeeName, LocalDate shiftDate, String startTime, String endTime, double hours, String shiftType) {
        this(employeeName, shiftDate, startTime, endTime, hours, 0, shiftType);
    }

    public Shift(String employeeName, LocalDate shiftDate, String startTime, String endTime, int lunchMinutes, String shiftType) {
        this(employeeName, shiftDate, startTime, endTime,
                calculateHours(startTime, endTime, lunchMinutes),
                effectiveLunchMinutes(startTime, endTime, lunchMinutes),
                shiftType);
    }

    public Shift(String employeeName, LocalDate shiftDate, String startTime, String endTime, double hours, int lunchMinutes, String shiftType) {
        this.employeeName = employeeName;
        this.shiftDate = shiftDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.lunchMinutes = lunchMinutes;
        this.hours = hours;
        this.shiftType = shiftType;
    }

    public Shift(String employeeName, LocalDate shiftDate, String startTime, String endTime, String shiftType) {
        this(employeeName, shiftDate, startTime, endTime, 0, shiftType);
    }

    public Shift(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                 int lunchMinutes, String shiftType, boolean onCall) {
        this(employeeName, shiftDate, startTime, endTime, lunchMinutes, shiftType);
        this.onCall = onCall;
    }

    public void renameEmployee(String employeeName) {
        this.employeeName = employeeName;
    }

    public void update(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                       int lunchMinutes, String shiftType) {
        this.employeeName = employeeName;
        this.shiftDate = shiftDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.lunchMinutes = effectiveLunchMinutes(startTime, endTime, lunchMinutes);
        this.hours = calculateHours(startTime, endTime, lunchMinutes);
        this.shiftType = shiftType;
    }

    public void update(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                       int lunchMinutes, String shiftType, boolean onCall) {
        update(employeeName, shiftDate, startTime, endTime, lunchMinutes, shiftType);
        this.onCall = onCall;
    }

    private static final long LUNCH_ELIGIBLE_MINUTES = Duration.ofHours(6).toMinutes();

    public static double calculateHours(String startTime, String endTime) {
        return calculateHours(startTime, endTime, 0);
    }

    public static double calculateHours(String startTime, String endTime, int lunchMinutes) {
        long minutes = shiftMinutes(startTime, endTime);
        long effectiveMinutes = minutes - effectiveLunchMinutes(minutes, lunchMinutes);
        return Math.max(0, effectiveMinutes) / 60.0;
    }

    private static int effectiveLunchMinutes(String startTime, String endTime, int lunchMinutes) {
        return effectiveLunchMinutes(shiftMinutes(startTime, endTime), lunchMinutes);
    }

    private static int effectiveLunchMinutes(long shiftMinutes, int lunchMinutes) {
        return shiftMinutes > LUNCH_ELIGIBLE_MINUTES ? Math.max(0, lunchMinutes) : 0;
    }

    private static long shiftMinutes(String startTime, String endTime) {
        LocalTime start = parseTime(startTime);
        LocalTime end = parseTime(endTime);
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes <= 0) {
            minutes += Duration.ofDays(1).toMinutes();
        }
        return minutes;
    }

    private static LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Start and end times are required");
        }
        String trimmed = value.trim();
        try {
            return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("h:mm a", Locale.US));
        } catch (DateTimeParseException ignored) {
            try {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("H:mm"));
            } catch (DateTimeParseException ignoredAgain) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("h:mm"));
            }
        }
    }

    public Long getId() { return id; }
    public String getEmployeeName() { return employeeName; }
    public LocalDate getShiftDate() { return shiftDate; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public int getLunchMinutes() { return lunchMinutes; }
    public double getHours() { return hours; }
    public String getShiftType() { return shiftType; }
    public boolean isOnCall() { return onCall; }
}
