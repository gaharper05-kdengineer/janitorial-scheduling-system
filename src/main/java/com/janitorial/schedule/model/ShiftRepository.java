package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
    // Backs the main weekly schedule view -- start/end are inclusive, a
    // Monday-to-Sunday range.
    List<Shift> findByShiftDateBetweenOrderByEmployeeNameAscShiftDateAsc(LocalDate start, LocalDate end);
    // Used when renaming or deleting an employee, to find every shift that
    // needs to move or go with them.
    List<Shift> findByEmployeeName(String employeeName);
}
