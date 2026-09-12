package com.janitorial.schedule.security;

import com.janitorial.schedule.model.ManagerAccount;
import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the default MANAGER and ADMIN accounts on first boot, from
 * app.manager.* / app.admin.* properties (in turn from MANAGER_USERNAME,
 * MANAGER_PASSWORD, ADMIN_USERNAME, ADMIN_PASSWORD env vars, or the
 * insecure "manager"/"admin" + "changeme123" local-dev defaults if unset).
 *
 * IMPORTANT gotcha: seeding only happens once per role (guarded by
 * countByRole == 0 below), so changing these env vars on an environment
 * that has already booted at least once does nothing -- the account already
 * exists with its original credentials. This bit us once in production: the
 * ADMIN feature was deployed before real ADMIN_USERNAME/ADMIN_PASSWORD were
 * set on Render, so it seeded the insecure local defaults; setting the real
 * env vars afterward and redeploying did NOT change the live account. The
 * fix was logging in with the seeded defaults and changing them through the
 * app's own "Update login credentials" UI (AccountController), which is
 * also the supported way to change either account's credentials going
 * forward -- editing these env vars after first boot is not.
 */
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
