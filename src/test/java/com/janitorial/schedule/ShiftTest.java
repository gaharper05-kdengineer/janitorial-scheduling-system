package com.janitorial.schedule;

import com.janitorial.schedule.model.Shift;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

// Covers the hours/lunch-deduction math in Shift, including the 6-hour
// eligibility threshold below which a requested lunch break is ignored.
class ShiftTest {

    @Test
    void calculatesHoursAfterLunchBreak() {
        assertEquals(7.5, Shift.calculateHours("9:00", "17:00", 30), 0.01);
        assertEquals(7.0, Shift.calculateHours("9:00", "17:00", 60), 0.01);
    }

    @Test
    void ignoresLunchWhenShiftIsSixHoursOrUnder() {
        assertEquals(6.0, Shift.calculateHours("9:00", "15:00", 30), 0.01);

        Shift shift = new Shift("Jamie", LocalDate.of(2026, 8, 19), "9:00", "15:00", 30, "day");
        assertEquals(0, shift.getLunchMinutes());
        assertEquals(6.0, shift.getHours(), 0.01);
    }

    @Test
    void appliesLunchWhenShiftIsOverSixHours() {
        Shift shift = new Shift("Jamie", LocalDate.of(2026, 8, 19), "9:00", "16:00", 30, "day");
        assertEquals(30, shift.getLunchMinutes());
        assertEquals(6.5, shift.getHours(), 0.01);
    }
}
