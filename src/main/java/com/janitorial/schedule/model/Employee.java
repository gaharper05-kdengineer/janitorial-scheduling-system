package com.janitorial.schedule.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "employees")
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true)
    private String name;
    @Column(name = "employee_id", unique = true)
    private String employeeId;
    private String password;
    @Column(name = "on_call", nullable = false)
    private boolean onCall;

    protected Employee() {
    }

    public Employee(String name, String employeeId, String password) {
        this(name, employeeId, password, false);
    }

    public Employee(String name, String employeeId, String password, boolean onCall) {
        this.name = name;
        this.employeeId = employeeId;
        this.password = password;
        this.onCall = onCall;
    }

    public void update(String name, String employeeId, String password, boolean onCall) {
        this.name = name;
        this.employeeId = employeeId;
        this.password = password;
        this.onCall = onCall;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmployeeId() { return employeeId; }
    public String getPassword() { return password; }
    public boolean isOnCall() { return onCall; }
}
