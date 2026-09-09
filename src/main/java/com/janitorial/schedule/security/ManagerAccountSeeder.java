package com.janitorial.schedule.security;

import com.janitorial.schedule.model.ManagerAccount;
import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class ManagerAccountSeeder implements ApplicationRunner {
    private final ManagerAccountRepository managerAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final String managerUsername;
    private final String managerPassword;
    private final String adminUsername;
    private final String adminPassword;

    public ManagerAccountSeeder(ManagerAccountRepository managerAccountRepository,
                                 PasswordEncoder passwordEncoder,
                                 @Value("${app.manager.username}") String managerUsername,
                                 @Value("${app.manager.password}") String managerPassword,
                                 @Value("${app.admin.username}") String adminUsername,
                                 @Value("${app.admin.password}") String adminPassword) {
        this.managerAccountRepository = managerAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.managerUsername = managerUsername;
        this.managerPassword = managerPassword;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (managerAccountRepository.countByRole("MANAGER") == 0) {
            managerAccountRepository.save(new ManagerAccount(managerUsername, passwordEncoder.encode(managerPassword), "MANAGER"));
        }
        if (managerAccountRepository.countByRole("ADMIN") == 0) {
            managerAccountRepository.save(new ManagerAccount(adminUsername, passwordEncoder.encode(adminPassword), "ADMIN"));
        }
    }
}
