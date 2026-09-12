package com.janitorial.schedule.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * Central access-control config. Three roles exist: EMPLOYEE (read-only
 * schedule view, logs in with a 5-digit ID -- see AppUserDetailsService),
 * MANAGER (can edit the schedule and roster), and ADMIN (everything MANAGER
 * can do, plus /api/admin/** for creating/managing other MANAGER accounts --
 * see AdminController, AdminSystemController). ADMIN inherits MANAGER's
 * access via the roleHierarchy bean below rather than every matcher listing
 * both roles explicitly; this was verified working against this exact
 * Spring Security version with a real request in
 * AdminControllerSecurityTest, not just assumed from the docs.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ADMIN automatically satisfies every hasRole("MANAGER") check below --
    // add a new MANAGER-only matcher here and ADMIN gets it for free, no
    // need to also write hasAnyRole("MANAGER", "ADMIN").
    @Bean
    static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role("ADMIN").implies("MANAGER")
                .build();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfTokenRequestHandler = new CsrfTokenRequestAttributeHandler();
        http
                // Matchers are evaluated in order and the first match wins,
                // so more specific rules (e.g. POST /api/schedule) must come
                // before the catch-all anyRequest().authenticated() -- any
                // logged-in user (including EMPLOYEE) can read the schedule,
                // but only MANAGER+ can mutate it.
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/login.html", "/employee-login.html", "/login", "/styles.css", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/schedule").hasRole("MANAGER")
                        .requestMatchers(HttpMethod.PUT, "/api/schedule/**").hasRole("MANAGER")
                        .requestMatchers(HttpMethod.DELETE, "/api/schedule/**").hasRole("MANAGER")
                        .requestMatchers("/api/employees/**").hasRole("MANAGER")
                        .requestMatchers(HttpMethod.PUT, "/api/account/credentials").hasRole("MANAGER")
                        .requestMatchers("/h2-console/**").hasRole("MANAGER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .formLogin(form -> form
                        .loginPage("/login.html")
                        .loginProcessingUrl("/login")
                        .defaultSuccessUrl("/", true)
                        .permitAll())
                .logout(logout -> logout
                        .logoutSuccessUrl("/login.html?logout"))
                // H2 console renders in an iframe; same-origin framing has
                // to be explicitly allowed or the browser blocks it.
                .headers(headers -> headers
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin))
                // Cookie-based CSRF (not the session-stored default) so a
                // plain static-HTML frontend with no server-side templating
                // can read the token via JS and echo it back as a header --
                // see csrfHeaders() in app.js. withHttpOnlyFalse() is
                // required for that JS read to work; h2-console is exempted
                // since it has its own CSRF handling.
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfTokenRequestHandler)
                        .ignoringRequestMatchers("/h2-console/**"))
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class);
        return http.build();
    }
}
