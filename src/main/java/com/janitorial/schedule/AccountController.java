package com.janitorial.schedule;

import com.janitorial.schedule.model.ManagerAccount;
import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final ManagerAccountRepository managerAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountController(ManagerAccountRepository managerAccountRepository, PasswordEncoder passwordEncoder) {
        this.managerAccountRepository = managerAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PutMapping("/credentials")
    public void updateCredentials(Principal principal, @RequestBody CredentialsRequest request) {
        ManagerAccount account = managerAccountRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found"));

        String currentPassword = request.currentPassword() == null ? "" : request.currentPassword();
        if (!passwordEncoder.matches(currentPassword, account.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        String newUsername = request.newUsername() == null ? "" : request.newUsername().trim();
        String newPassword = request.newPassword() == null ? "" : request.newPassword();
        if (newUsername.isEmpty() || newPassword.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username and new password are required");
        }

        account.updateCredentials(newUsername, passwordEncoder.encode(newPassword));
        managerAccountRepository.save(account);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason()));
    }

    public record CredentialsRequest(String currentPassword, String newUsername, String newPassword) {
    }
}
