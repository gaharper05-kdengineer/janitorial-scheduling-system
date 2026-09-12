package com.janitorial.schedule;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for CleanTrack, a weekly janitorial staff scheduling app.
 * Active profile controls the datasource: no profile (local dev) uses an
 * in-memory H2 database seeded from data.sql; the "prod" profile (set via
 * SPRING_PROFILES_ACTIVE on Render) uses Postgres and runs Flyway migrations
 * from src/main/resources/db/migration instead. See application.properties
 * and application-prod.properties for the exact per-environment config.
 */
@SpringBootApplication
public class ScheduleApplication {
    public static void main(String[] args) {
        SpringApplication.run(ScheduleApplication.class, args);
    }
}

