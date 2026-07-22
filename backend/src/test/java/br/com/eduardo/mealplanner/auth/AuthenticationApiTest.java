package br.com.eduardo.mealplanner.auth;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "server.servlet.session.cookie.secure=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthenticationApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void blocksAnonymousAccessToBusinessEndpointsWithJsonError() throws Exception {
		mockMvc.perform(get("/api/v1/ingredients"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
	}

	@Test
	void registersLogsInAndReturnsTheAuthenticatedUser() throws Exception {
		var registration = """
				{
				  "displayName": "Ana Souza",
				  "email": "ANA@EXAMPLE.COM",
				  "password": "uma-senha-segura-2026"
				}
				""";

		mockMvc.perform(post("/api/v1/auth/register")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(registration))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.displayName").value("Ana Souza"))
				.andExpect(jsonPath("$.email").value("ana@example.com"))
				.andExpect(jsonPath("$.role").value("USER"))
				.andExpect(jsonPath("$.password").doesNotExist());

		var anonymousSession = new MockHttpSession();
		var anonymousSessionId = anonymousSession.getId();
		var login = mockMvc.perform(post("/api/v1/auth/login")
				.session(anonymousSession)
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"ana@example.com","password":"uma-senha-segura-2026"}
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("ana@example.com"))
				.andReturn();

		var session = (MockHttpSession) login.getRequest().getSession(false);
		assertNotNull(session);
		assertNotEquals(anonymousSessionId, session.getId());
		mockMvc.perform(get("/api/v1/auth/me").session(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.displayName").value("Ana Souza"));
	}

	@Test
	void rejectsDuplicateEmailWeakPasswordAndInvalidCredentials() throws Exception {
		register("Bruno", "bruno@example.com", "senha-forte-para-bruno");

		mockMvc.perform(post("/api/v1/auth/register")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"displayName":"Outro Bruno","email":" BRUNO@example.com ","password":"outra-senha-bem-segura"}
						"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));

		mockMvc.perform(post("/api/v1/auth/register")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"displayName":"Senha Fraca","email":"fraca@example.com","password":"curta"}
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.password").exists());

		mockMvc.perform(post("/api/v1/auth/login")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"bruno@example.com","password":"senha-incorreta"}
						"""))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void returnsTheSameInvalidCredentialsErrorForDisabledAccounts() throws Exception {
		register("Conta Desativada", "disabled@example.com", "senha-forte-desativada");
		jdbcTemplate.update("UPDATE app_users SET enabled = false WHERE email = ?", "disabled@example.com");

		mockMvc.perform(post("/api/v1/auth/login")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"disabled@example.com","password":"senha-forte-desativada"}
						"""))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void exposesCsrfTokenForTheSameOriginSpa() throws Exception {
		var result = mockMvc.perform(get("/api/v1/auth/csrf"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.token").isString())
				.andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
				.andReturn();
		assertNotNull(result.getRequest().getSession(false));
	}

	@Test
	void enforcesCsrfAndAdministrativeAuthorization() throws Exception {
		mockMvc.perform(post("/api/v1/ingredients")
				.with(user("user@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Arroz","defaultUnit":"GRAM"}
						"""))
				.andExpect(status().isForbidden());

		mockMvc.perform(get("/actuator/info")
				.with(user("user@example.com").roles("USER")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

		mockMvc.perform(get("/actuator/info")
				.with(user("admin@example.com").roles("ADMIN")))
				.andExpect(status().isOk());

		mockMvc.perform(get("/swagger-ui.html")
				.with(user("user@example.com").roles("USER")))
				.andExpect(status().isForbidden());
	}

	@Test
	void logoutInvalidatesTheConfiguredSessionCookie() throws Exception {
		mockMvc.perform(post("/api/v1/auth/logout")
				.with(user("user@example.com").roles("USER"))
				.with(csrf())
				.cookie(new Cookie("EUCHEFSESSION", "session-id")))
				.andExpect(status().isNoContent())
				.andExpect(header().string(HttpHeaders.SET_COOKIE,
						org.hamcrest.Matchers.containsString("EUCHEFSESSION=")))
				.andExpect(header().string(HttpHeaders.SET_COOKIE,
						org.hamcrest.Matchers.containsString("Max-Age=0")))
				.andExpect(header().string(HttpHeaders.SET_COOKIE,
						org.hamcrest.Matchers.containsString("Secure")));
	}

	@Test
	void addsSecurityHeadersToApiResponses() throws Exception {
		mockMvc.perform(get("/api/v1/ingredients"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("X-Content-Type-Options", "nosniff"))
				.andExpect(header().string("X-Frame-Options", "DENY"))
				.andExpect(header().string("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
				.andExpect(header().string("Referrer-Policy", "no-referrer"))
				.andExpect(header().string("Permissions-Policy", "camera=(), geolocation=(), microphone=()"));
	}

	private void register(String displayName, String email, String password) throws Exception {
		mockMvc.perform(post("/api/v1/auth/register")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"displayName":"%s","email":"%s","password":"%s"}
						""".formatted(displayName, email, password)))
				.andExpect(status().isCreated());
	}
}
