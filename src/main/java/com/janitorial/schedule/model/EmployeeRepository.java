package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    // Used at login time to resolve the 5-digit ID an employee types in.
    Optional<Employee> findByEmployeeId(String employeeId);
    // Employee names are unique (see V5 migration); this is how shifts and
    // the roster get reconciled -- see ScheduleController.
    Optional<Employee> findByName(String name);
}
