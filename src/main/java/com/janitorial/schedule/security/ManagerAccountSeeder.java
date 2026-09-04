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

    public ManagerAccountSeeder(ManagerAccountRepository managerAccountRepository,
                                 PasswordEncoder passwordEncoder,
                                 @Value("${app.manager.username}") String managerUsername,
                                 @Value("${app.manager.password}") String managerPassword) {
        this.managerAccountRepository = managerAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.managerUsername = managerUsername;
        this.managerPassword = managerPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (managerAccountRepository.count() == 0) {
            managerAccountRepository.save(new ManagerAccount(managerUsername, passwordEncoder.encode(managerPassword)));
        }
    }
}
