package naeil.dashboard.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerLoginRoutingTest {

    private AuthService authService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();
    }

    @Test
    void platformLoginDoesNotRequireCompanyCode() throws Exception {
        AuthUser user = platformAdmin();
        when(authService.platformLogin("admin", "password")).thenReturn(user);
        when(authService.createToken(user)).thenReturn("token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"admin","password":"password"}
                                """))
                .andExpect(status().isOk());

        verify(authService).platformLogin("admin", "password");
    }

    @Test
    void tenantLoginUsesCompanyCode() throws Exception {
        AuthUser user = tenantEmployee();
        when(authService.tenantLogin("NVPZ7", "employee", "password")).thenReturn(user);
        when(authService.createToken(user)).thenReturn("token");

        mockMvc.perform(post("/api/auth/tenant-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyCode":"NVPZ7","loginId":"employee","password":"password"}
                                """))
                .andExpect(status().isOk());

        verify(authService).tenantLogin("NVPZ7", "employee", "password");
    }

    private AuthUser platformAdmin() {
        return new AuthUser(1L, 1L, "admin", "Admin", null, null, "EXECUTIVE",
                "PLATFORM", "ADMIN", "ACTIVE", null);
    }

    private AuthUser tenantEmployee() {
        return new AuthUser(2L, 1L, "employee", "Employee", null, null, "EMPLOYEE",
                "TENANT", "EMPLOYEE", "ACTIVE", null);
    }
}
