package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
    List<Shift> findByShiftDateBetweenOrderByEmployeeNameAscShiftDateAsc(LocalDate start, LocalDate end);
    List<Shift> findByEmployeeName(String employeeName);
}
