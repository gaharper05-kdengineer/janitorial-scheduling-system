package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ManagerAccountRepository extends JpaRepository<ManagerAccount, Long> {
    Optional<ManagerAccount> findByUsername(String username);
    // Used by ManagerAccountSeeder to decide whether a default MANAGER/ADMIN
    // account still needs to be created -- see that class for why this makes
    // the seeder a one-time-only action per role, not a sync-on-every-boot.
    long countByRole(String role);
    // Used by AdminController to list only MANAGER accounts, never ADMIN
    // ones, in the "Manage managers" UI.
    List<ManagerAccount> findByRole(String role);
}
