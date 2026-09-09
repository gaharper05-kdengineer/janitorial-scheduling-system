package com.janitorial.schedule.model;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ManagerAccountRepository extends JpaRepository<ManagerAccount, Long> {
    Optional<ManagerAccount> findByUsername(String username);
    long countByRole(String role);
    List<ManagerAccount> findByRole(String role);
}
