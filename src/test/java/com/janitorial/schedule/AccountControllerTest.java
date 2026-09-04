package com.janitorial.schedule;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AccountControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "manager", roles = "MANAGER")
    void wrongCurrentPasswordIsRejected() throws Exception {
        mockMvc.perform(put("/api/account/credentials")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong\",\"newUsername\":\"manager\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void correctChangePersistsAndOldPasswordNoLongerWorks() throws Exception {
        mockMvc.perform(put("/api/account/credentials")
                        .with(user("manager").roles("MANAGER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"changeme123\",\"newUsername\":\"manager\",\"newPassword\":\"newSecret456\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(formLogin("/login").user("manager").password("changeme123"))
                .andExpect(unauthenticated());

        mockMvc.perform(formLogin("/login").user("manager").password("newSecret456"))
                .andExpect(authenticated());
    }
}
