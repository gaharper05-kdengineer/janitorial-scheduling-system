package com.janitorial.schedule;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Confirms /api/admin/** is ADMIN-only, and -- the important part --
// concretely proves the RoleHierarchy bean in SecurityConfig actually makes
// ADMIN inherit MANAGER access at runtime (not just in theory), by having an
// ADMIN-authenticated request succeed against a real MANAGER-only endpoint.
@SpringBootTest
@AutoConfigureMockMvc
class AdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void managerCannotAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/managers")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = "ADMIN")
    void adminCanAccessAdminEndpointsAndInheritsManagerAccess() throws Exception {
        mockMvc.perform(get("/api/admin/managers")).andExpect(status().isOk());

        mockMvc.perform(post("/api/schedule")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeName\":\"Test\",\"shiftDate\":\"2026-09-07\",\"startTime\":\"09:00\",\"endTime\":\"17:00\",\"lunchMinutes\":0,\"shiftType\":\"day\"}"))
                .andExpect(status().isOk());
    }
}
