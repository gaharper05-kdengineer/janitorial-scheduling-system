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

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {
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

    @DeleteMapping("/employees/{employeeName}")
    public void deleteEmployee(@PathVariable String employeeName) {
        employeeRepository.findByName(employeeName).ifPresent(employeeRepository::delete);
    }

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
