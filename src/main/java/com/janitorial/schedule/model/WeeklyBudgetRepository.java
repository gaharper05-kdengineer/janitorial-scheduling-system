package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface WeeklyBudgetRepository extends JpaRepository<WeeklyBudget, Long> {
    Optional<WeeklyBudget> findByWeekStart(LocalDate weekStart);
}
