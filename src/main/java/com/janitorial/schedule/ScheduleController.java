package com.janitorial.schedule;

import com.janitorial.schedule.model.Employee;
import com.janitorial.schedule.model.EmployeeRepository;
import com.janitorial.schedule.model.Shift;
import com.janitorial.schedule.model.ShiftRepository;
import com.janitorial.schedule.model.WeeklyBudget;
import com.janitorial.schedule.model.WeeklyBudgetRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Owns the weekly schedule: shifts, the per-week hour budget, and roster
 * mutations that originate from editing a shift or the employee dialog
 * (rename, assign a 5-digit login ID, delete). All write endpoints require
 * MANAGER (or ADMIN, via the role hierarchy) -- see SecurityConfig.
 */
@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {
    // Falls back to this when a week has no WeeklyBudget row yet (416 = a
    // round default for a mid-size crew's weekly hours; each week can
    // override it independently via PUT /api/schedule/budget).
    private static final double DEFAULT_BUDGET_HOURS = 416;

    private final ShiftRepository shiftRepository;
    private final EmployeeRepository employeeRepository;
    private final WeeklyBudgetRepository weeklyBudgetRepository;
    private final PasswordEncoder passwordEncoder;

    public ScheduleController(ShiftRepository shiftRepository, EmployeeRepository employeeRepository,
                               WeeklyBudgetRepository weeklyBudgetRepository, PasswordEncoder passwordEncoder) {
        this.shiftRepository = shiftRepository;
        this.employeeRepository = employeeRepository;
        this.weeklyBudgetRepository = weeklyBudgetRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<ShiftResponse> getWeek(@RequestParam(required = false) LocalDate weekStart) {
        LocalDate monday = weekStart == null ? LocalDate.now().with(DayOfWeek.MONDAY) : weekStart;
        List<Shift> shifts = shiftRepository.findByShiftDateBetweenOrderByEmployeeNameAscShiftDateAsc(monday, monday.plusDays(6));
        Map<String, Boolean> onCallByName = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getName, Employee::isOnCall, (a, b) -> a));
        return shifts.stream()
                .map(shift -> new ShiftResponse(shift.getId(), shift.getEmployeeName(), shift.getShiftDate(),
                        shift.getStartTime(), shift.getEndTime(), shift.getLunchMinutes(), shift.getHours(),
                        shift.getShiftType(), shift.isOnCall(), onCallByName.getOrDefault(shift.getEmployeeName(), false)))
                .toList();
    }

    @GetMapping("/budget")
    public BudgetResponse getBudget(@RequestParam LocalDate weekStart) {
        double hours = weeklyBudgetRepository.findByWeekStart(weekStart)
                .map(WeeklyBudget::getHours)
                .orElse(DEFAULT_BUDGET_HOURS);
        return new BudgetResponse(hours);
    }

    @PutMapping("/budget")
    public BudgetResponse saveBudget(@RequestBody BudgetRequest request) {
        WeeklyBudget budget = weeklyBudgetRepository.findByWeekStart(request.weekStart()).orElse(null);
        if (budget != null) {
            budget.update(request.hours());
        } else {
            budget = new WeeklyBudget(request.weekStart(), request.hours());
        }
        weeklyBudgetRepository.save(budget);
        return new BudgetResponse(budget.getHours());
    }

    @PostMapping
    public Shift addShift(@RequestBody ShiftRequest request) {
        ensureEmployeeExists(request.employeeName());
        int lunchMinutes = request.lunchMinutes() == null ? 0 : request.lunchMinutes();
        boolean onCall = request.onCall() != null && request.onCall();
        return shiftRepository.save(new Shift(
                request.employeeName(), request.shiftDate(), request.startTime(), request.endTime(),
                lunchMinutes, request.shiftType(), onCall));
    }

    @PutMapping("/{id}")
    public Shift updateShift(@PathVariable Long id, @RequestBody ShiftRequest request) {
        ensureEmployeeExists(request.employeeName());
        Shift shift = shiftRepository.findById(id).orElseThrow();
        int lunchMinutes = request.lunchMinutes() == null ? 0 : request.lunchMinutes();
        boolean onCall = request.onCall() != null && request.onCall();
        shift.update(request.employeeName(), request.shiftDate(), request.startTime(), request.endTime(),
                lunchMinutes, request.shiftType(), onCall);
        return shiftRepository.save(shift);
    }

    // Adding a shift for a name not yet on the roster should just add them
    // to the roster too, rather than failing -- this is the only place new
    // Employee rows get created outside of the explicit "Add employee" flow.
    // The unique constraint on Employee.name (V5 migration) is what makes
    // the catch here safe: if two requests race to create the same new
    // employee, one wins and the other's insert fails, which is fine since
    // by then the employee already exists.
    private void ensureEmployeeExists(String employeeName) {
        if (employeeRepository.findByName(employeeName).isEmpty()) {
            try {
                employeeRepository.saveAndFlush(new Employee(employeeName, null, null));
            } catch (DataIntegrityViolationException alreadyCreatedConcurrently) {
                // another request created this employee first; nothing left to do
            }
        }
    }

    @DeleteMapping("/{id}")
    public void deleteShift(@PathVariable Long id) {
        shiftRepository.deleteById(id);
    }

    // Handles both renaming an employee and assigning/changing their 5-digit
    // login ID in one request. Name and ID each must stay unique, but a save
    // that doesn't actually change the conflicting field (e.g. re-saving the
    // same employee with their own existing ID) must not trip the duplicate
    // check against itself -- hence comparing against currentEmployee's id
    // rather than just checking "does another row have this name/ID".
    @PutMapping("/employees/{employeeName}")
    public List<Shift> updateEmployee(@PathVariable String employeeName, @RequestBody EmployeeUpdateRequest request) {
        String newName = request.employeeName() == null ? "" : request.employeeName().trim();
        if (newName.isEmpty()) {
            throw new IllegalArgumentException("Employee name is required");
        }
        String employeeId = request.employeeId() == null ? "" : request.employeeId().trim();
        if (!employeeId.isEmpty() && !employeeId.matches("\\d{5}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee ID must be exactly 5 digits");
        }
        Employee employee = employeeRepository.findByName(employeeName).orElse(null);
        if (!newName.equals(employeeName)) {
            Employee currentEmployee = employee;
            employeeRepository.findByName(newName).ifPresent(existing -> {
                if (currentEmployee == null || !existing.getId().equals(currentEmployee.getId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "An employee named " + newName + " already exists");
                }
            });
        }
        if (!employeeId.isEmpty()) {
            Employee currentEmployee = employee;
            employeeRepository.findByEmployeeId(employeeId).ifPresent(existing -> {
                if (currentEmployee == null || !existing.getId().equals(currentEmployee.getId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "That employee ID is already assigned to " + existing.getName());
                }
            });
        }
        String newEmployeeId = employeeId.isEmpty() ? null : employeeId;
        String encodedPassword = employeeId.isEmpty() ? null : passwordEncoder.encode(employeeId);
        boolean onCall = request.onCall() != null && request.onCall();
        if (employee != null) {
            employee.update(newName, newEmployeeId, encodedPassword, onCall);
            employeeRepository.save(employee);
        } else if (newEmployeeId != null || onCall) {
            employeeRepository.save(new Employee(newName, newEmployeeId, encodedPassword, onCall));
        }
        List<Shift> shifts = shiftRepository.findByEmployeeName(employeeName);
        shifts.forEach(shift -> shift.renameEmployee(newName));
        return shiftRepository.saveAll(shifts);
    }

    // "Delete employee" (the roster-only removal, triggered from the
    // employee dialog's "Delete employee" button) intentionally keeps
    // today's and past shifts on the schedule -- only shifts strictly after
    // today are removed. This preserves the historical/current record (e.g.
    // for payroll) while stopping the person from being scheduled going
    // forward. Contrast with deleteEmployeeHistory below, which is a full,
    // irreversible purge.
    @DeleteMapping("/employees/{employeeName}")
    public void deleteEmployee(@PathVariable String employeeName) {
        LocalDate today = LocalDate.now();
        List<Shift> futureShifts = shiftRepository.findByEmployeeName(employeeName).stream()
                .filter(shift -> shift.getShiftDate().isAfter(today))
                .toList();
        shiftRepository.deleteAll(futureShifts);
        employeeRepository.findByName(employeeName).ifPresent(employeeRepository::delete);
    }

    // "Remove from history" -- deletes every shift the employee ever had,
    // past and future, plus the roster row. Irreversible; the UI confirms
    // this explicitly before calling it (see confirmDelete() in app.js) and
    // keeps it as a visually distinct, separate button from deleteEmployee
    // above so the two aren't confused.
    @DeleteMapping("/employees/{employeeName}/history")
    public void deleteEmployeeHistory(@PathVariable String employeeName) {
        shiftRepository.deleteAll(shiftRepository.findByEmployeeName(employeeName));
        employeeRepository.findByName(employeeName).ifPresent(employeeRepository::delete);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason()));
    }

    public record ShiftRequest(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                               Integer lunchMinutes, String shiftType, Boolean onCall) {
    }

    public record EmployeeUpdateRequest(String employeeName, String employeeId, Boolean onCall) {
    }

    public record ShiftResponse(Long id, String employeeName, LocalDate shiftDate, String startTime, String endTime,
                                int lunchMinutes, double hours, String shiftType, boolean onCall, boolean employeeOnCall) {
    }

    public record BudgetRequest(LocalDate weekStart, double hours) {
    }

    public record BudgetResponse(double hours) {
    }
}
