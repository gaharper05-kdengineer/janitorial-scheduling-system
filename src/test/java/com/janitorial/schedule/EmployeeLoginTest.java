package com.janitorial.schedule;

import com.janitorial.schedule.model.Employee;
import com.janitorial.schedule.model.EmployeeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmployeeLoginTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void employeeLogsInWithIdAndSeesEmployeeRole() throws Exception {
        employeeRepository.save(new Employee("Test Employee", "54321", passwordEncoder.encode("54321")));

        MvcResult loginResult = mockMvc.perform(formLogin("/login").user("54321").password("54321"))
                .andExpect(authenticated())
                .andReturn();

        mockMvc.perform(get("/api/account/me").session((MockHttpSession) loginResult.getRequest().getSession(false)))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"role\":\"EMPLOYEE\"}"));
    }

    @Test
    void duplicateEmployeeIdIsRejected() throws Exception {
        mockMvc.perform(put("/api/schedule/employees/Jane")
                        .with(user("manager").roles("MANAGER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeName\":\"Jane\",\"employeeId\":\"11111\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/schedule/employees/Patrick")
                        .with(user("manager").roles("MANAGER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeName\":\"Patrick\",\"employeeId\":\"11111\"}"))
                .andExpect(status().isBadRequest());
    }
}
