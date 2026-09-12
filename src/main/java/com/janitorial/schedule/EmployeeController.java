package com.janitorial.schedule;

import com.janitorial.schedule.model.EmployeeRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only roster listing, used by the frontend to populate employee
 * autocomplete/selection and on-call badges. Roster mutations (rename,
 * delete, assign an ID) live on ScheduleController instead, under
 * /api/schedule/employees/** -- this class only ever reads.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
    private final EmployeeRepository employeeRepository;

    public EmployeeController(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @GetMapping
    public List<EmployeeSummary> listEmployees() {
        return employeeRepository.findAll().stream()
                .map(employee -> new EmployeeSummary(employee.getName(), employee.getEmployeeId(), employee.isOnCall()))
                .toList();
    }

    public record EmployeeSummary(String name, String employeeId, boolean onCall) {
    }
}
