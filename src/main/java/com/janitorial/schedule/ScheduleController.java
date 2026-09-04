package com.janitorial.schedule;

import com.janitorial.schedule.model.Employee;
import com.janitorial.schedule.model.EmployeeRepository;
import com.janitorial.schedule.model.Shift;
import com.janitorial.schedule.model.ShiftRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
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

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {
    private final ShiftRepository shiftRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;

    public ScheduleController(ShiftRepository shiftRepository, EmployeeRepository employeeRepository,
                               PasswordEncoder passwordEncoder) {
        this.shiftRepository = shiftRepository;
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<Shift> getWeek(@RequestParam(required = false) LocalDate weekStart) {
        LocalDate monday = weekStart == null ? LocalDate.now().with(DayOfWeek.MONDAY) : weekStart;
        return shiftRepository.findByShiftDateBetweenOrderByEmployeeNameAscShiftDateAsc(monday, monday.plusDays(6));
    }

    @PostMapping
    public Shift addShift(@RequestBody ShiftRequest request) {
        int lunchMinutes = request.lunchMinutes() == null ? 0 : request.lunchMinutes();
        return shiftRepository.save(new Shift(
                request.employeeName(), request.shiftDate(), request.startTime(), request.endTime(),
                lunchMinutes, request.shiftType()));
    }

    @PutMapping("/{id}")
    public Shift updateShift(@PathVariable Long id, @RequestBody ShiftRequest request) {
        Shift shift = shiftRepository.findById(id).orElseThrow();
        int lunchMinutes = request.lunchMinutes() == null ? 0 : request.lunchMinutes();
        shift.update(request.employeeName(), request.shiftDate(), request.startTime(), request.endTime(),
                lunchMinutes, request.shiftType());
        return shiftRepository.save(shift);
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
        if (employee != null) {
            employee.update(newName, newEmployeeId, encodedPassword);
            employeeRepository.save(employee);
        } else if (newEmployeeId != null) {
            employeeRepository.save(new Employee(newName, newEmployeeId, encodedPassword));
        }
        List<Shift> shifts = shiftRepository.findByEmployeeName(employeeName);
        shifts.forEach(shift -> shift.renameEmployee(newName));
        return shiftRepository.saveAll(shifts);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason()));
    }

    public record ShiftRequest(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                               Integer lunchMinutes, String shiftType) {
    }

    public record EmployeeUpdateRequest(String employeeName, String employeeId) {
    }
}
