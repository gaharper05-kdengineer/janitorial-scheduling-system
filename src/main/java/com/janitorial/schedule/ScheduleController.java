package com.janitorial.schedule;

import com.janitorial.schedule.model.Shift;
import com.janitorial.schedule.model.ShiftRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {
    private final ShiftRepository shiftRepository;

    public ScheduleController(ShiftRepository shiftRepository) {
        this.shiftRepository = shiftRepository;
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
    public List<Shift> renameEmployee(@PathVariable String employeeName, @RequestBody EmployeeRenameRequest request) {
        String newName = request.employeeName() == null ? "" : request.employeeName().trim();
        if (newName.isEmpty()) {
            throw new IllegalArgumentException("Employee name is required");
        }
        List<Shift> shifts = shiftRepository.findByEmployeeName(employeeName);
        shifts.forEach(shift -> shift.renameEmployee(newName));
        return shiftRepository.saveAll(shifts);
    }

    public record ShiftRequest(String employeeName, LocalDate shiftDate, String startTime, String endTime,
                               Integer lunchMinutes, String shiftType) {
    }

    public record EmployeeRenameRequest(String employeeName) {
    }
}
