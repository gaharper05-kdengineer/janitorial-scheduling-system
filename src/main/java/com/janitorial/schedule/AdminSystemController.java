package com.janitorial.schedule;

import com.janitorial.schedule.model.EmployeeRepository;
import com.janitorial.schedule.model.ShiftRepository;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Arrays;

/**
 * ADMIN-only read-only diagnostics (active environment, database
 * connectivity, roster/shift counts, server time), surfaced through the
 * "System status" option in the account menu. Exists so the developer can
 * sanity-check the deployed app without direct database or Render dashboard
 * access.
 */
@RestController
@RequestMapping("/api/admin/system")
public class AdminSystemController {
    private final Environment environment;
    private final JdbcTemplate jdbcTemplate;
    private final EmployeeRepository employeeRepository;
    private final ShiftRepository shiftRepository;

    public AdminSystemController(Environment environment, JdbcTemplate jdbcTemplate,
                                  EmployeeRepository employeeRepository, ShiftRepository shiftRepository) {
        this.environment = environment;
        this.jdbcTemplate = jdbcTemplate;
        this.employeeRepository = employeeRepository;
        this.shiftRepository = shiftRepository;
    }

    @GetMapping
    public SystemStatus status() {
        // "prod" is set via SPRING_PROFILES_ACTIVE on Render (see
        // application-prod.properties); its absence means local H2 dev.
        // This is more reliable than the frontend's old hostname-based
        // "DEMO MODE" badge check, since it reflects what's actually
        // configured server-side rather than guessing from the URL.
        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        String databaseProduct;
        String databaseStatus;
        try {
            databaseProduct = jdbcTemplate.getDataSource().getConnection().getMetaData().getDatabaseProductName();
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            databaseStatus = "connected";
        } catch (Exception ex) {
            databaseProduct = "unknown";
            databaseStatus = "error: " + ex.getMessage();
        }
        return new SystemStatus(
                isProd ? "Production" : "Local / Demo",
                databaseProduct,
                databaseStatus,
                employeeRepository.count(),
                shiftRepository.count(),
                Instant.now().toString());
    }

    public record SystemStatus(String environment, String databaseProduct, String databaseStatus,
                                long employeeCount, long shiftCount, String serverTime) {
    }
}
