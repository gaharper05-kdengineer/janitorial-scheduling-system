package com.janitorial.schedule;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Baseline auth check: anonymous requests get redirected to login, an
// authenticated MANAGER gets through.
@SpringBootTest
@AutoConfigureMockMvc
class ScheduleControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unauthenticatedRequestIsRedirectedToLogin() throws Exception {
        mockMvc.perform(get("/api/schedule")).andExpect(status().is3xxRedirection());
    }

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void authenticatedRequestSucceeds() throws Exception {
        mockMvc.perform(get("/api/schedule")).andExpect(status().isOk());
    }
}
