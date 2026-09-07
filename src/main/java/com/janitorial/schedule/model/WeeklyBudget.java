package com.janitorial.schedule.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "weekly_budgets")
public class WeeklyBudget {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "week_start", unique = true, nullable = false)
    private LocalDate weekStart;
    @Column(nullable = false)
    private double hours;

    protected WeeklyBudget() {
    }

    public WeeklyBudget(LocalDate weekStart, double hours) {
        this.weekStart = weekStart;
        this.hours = hours;
    }

    public void update(double hours) {
        this.hours = hours;
    }

    public Long getId() { return id; }
    public LocalDate getWeekStart() { return weekStart; }
    public double getHours() { return hours; }
}
