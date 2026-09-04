package com.janitorial.schedule.security;

import com.janitorial.schedule.model.ManagerAccountRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class ManagerUserDetailsService implements UserDetailsService {
    private final ManagerAccountRepository managerAccountRepository;

    public ManagerUserDetailsService(ManagerAccountRepository managerAccountRepository) {
        this.managerAccountRepository = managerAccountRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return managerAccountRepository.findByUsername(username)
                .map(account -> User.builder()
                        .username(account.getUsername())
                        .password(account.getPassword())
                        .roles("MANAGER")
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("Manager account not found: " + username));
    }
}
