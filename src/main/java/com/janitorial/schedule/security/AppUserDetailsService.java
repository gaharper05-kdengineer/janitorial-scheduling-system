package com.janitorial.schedule.security;

import com.janitorial.schedule.model.EmployeeRepository;
import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AppUserDetailsService implements UserDetailsService {
    private final ManagerAccountRepository managerAccountRepository;
    private final EmployeeRepository employeeRepository;

    public AppUserDetailsService(ManagerAccountRepository managerAccountRepository,
                                  EmployeeRepository employeeRepository) {
        this.managerAccountRepository = managerAccountRepository;
        this.employeeRepository = employeeRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return managerAccountRepository.findByUsername(username)
                .map(account -> User.builder()
                        .username(account.getUsername())
                        .password(account.getPassword())
                        .roles(account.getRole())
                        .build())
                .or(() -> employeeRepository.findByEmployeeId(username)
                        .map(employee -> User.builder()
                                .username(employee.getEmployeeId())
                                .password(employee.getPassword())
                                .roles("EMPLOYEE")
                                .build()))
                .orElseThrow(() -> new UsernameNotFoundException("Account not found: " + username));
    }
}
