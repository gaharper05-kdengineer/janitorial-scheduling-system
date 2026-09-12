package com.janitorial.schedule.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forces the CSRF token to actually be generated (and written to the
 * XSRF-TOKEN cookie by CookieCsrfTokenRepository) on every request, not just
 * ones that read it. Spring Security's CsrfToken is lazily resolved --
 * without this filter calling getToken(), a page load that never touches
 * the token wouldn't get a fresh cookie, and the frontend's csrfHeaders()
 * helper (app.js) would have nothing to read for the next POST/PUT/DELETE.
 */
public class CsrfCookieFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrfToken != null) {
            csrfToken.getToken();
        }
        filterChain.doFilter(request, response);
    }
}
