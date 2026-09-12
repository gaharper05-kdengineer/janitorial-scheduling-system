package com.janitorial.schedule.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A username/password login with elevated (non-employee) access. Despite the
 * class name this table holds both MANAGER and ADMIN accounts, distinguished
 * by {@code role} -- they share one table because both are "a login with
 * management access," and ADMIN is really MANAGER-plus-more (see the
 * RoleHierarchy bean in SecurityConfig, which grants ADMIN every MANAGER
 * permission automatically). The two default accounts are created on first
 * boot by ManagerAccountSeeder.
 */
@Entity
@Table(name = "manager_accounts")
public class ManagerAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String username;
    private String password;
    private String role;

    protected ManagerAccount() {
    }

    public ManagerAccount(String username, String password, String role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }

    public void updateCredentials(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    public String getRole() { return role; }
}
