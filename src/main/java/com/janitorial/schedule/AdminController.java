package com.janitorial.schedule;

import com.janitorial.schedule.model.ManagerAccount;
import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/managers")
public class AdminController {
    private final ManagerAccountRepository managerAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminController(ManagerAccountRepository managerAccountRepository, PasswordEncoder passwordEncoder) {
        this.managerAccountRepository = managerAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<ManagerSummary> listManagers() {
        return managerAccountRepository.findByRole("MANAGER").stream()
                .map(account -> new ManagerSummary(account.getId(), account.getUsername()))
                .toList();
    }

    @PostMapping
    public ManagerSummary createManager(@RequestBody CreateManagerRequest request) {
        String username = request.username() == null ? "" : request.username().trim();
        String password = request.password() == null ? "" : request.password();
        if (username.isEmpty() || password.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username and password are required");
        }
        if (managerAccountRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That username is already taken");
        }
        ManagerAccount account = managerAccountRepository.save(
                new ManagerAccount(username, passwordEncoder.encode(password), "MANAGER"));
        return new ManagerSummary(account.getId(), account.getUsername());
    }

    @PutMapping("/{id}/password")
    public void resetPassword(@PathVariable Long id, @RequestBody ResetPasswordRequest request) {
        String newPassword = request.newPassword() == null ? "" : request.newPassword();
        if (newPassword.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password is required");
        }
        ManagerAccount account = managerAccountRepository.findById(id)
                .filter(existing -> "MANAGER".equals(existing.getRole()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Manager account not found"));
        account.updateCredentials(account.getUsername(), passwordEncoder.encode(newPassword));
        managerAccountRepository.save(account);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason()));
    }

    public record ManagerSummary(Long id, String username) {
    }

    public record CreateManagerRequest(String username, String password) {
    }

    public record ResetPasswordRequest(String newPassword) {
    }
}
