package com.janitorial.schedule;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmployeeRoleSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "12345", roles = "EMPLOYEE")
    void employeeCanViewSchedule() throws Exception {
        mockMvc.perform(get("/api/schedule")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "12345", roles = "EMPLOYEE")
    void employeeCannotModifySchedule() throws Exception {
        mockMvc.perform(post("/api/schedule")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeName\":\"Test\",\"shiftDate\":\"2026-09-07\",\"startTime\":\"09:00\",\"endTime\":\"17:00\",\"lunchMinutes\":0,\"shiftType\":\"day\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/schedule/employees/Jane")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeName\":\"Jane\",\"employeeId\":\"11111\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/schedule/1").with(csrf()))
                .andExpect(status().isForbidden());
    }
}
