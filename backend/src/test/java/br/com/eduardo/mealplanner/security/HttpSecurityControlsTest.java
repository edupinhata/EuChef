package br.com.eduardo.mealplanner.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
		"euchef.security.allowed-origins=http://localhost:5173",
		"euchef.security.max-request-size=256B",
		"euchef.security.rate-limit.api-requests=2",
		"euchef.security.rate-limit.auth-requests=2",
		"euchef.security.rate-limit.window=1m",
		"euchef.security.rate-limit.max-clients=100"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class HttpSecurityControlsTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void permitsOnlyConfiguredCorsOriginWithCredentials() throws Exception {
		mockMvc.perform(options("/api/v1/ingredients")
				.with(request -> withRemoteAddress(request, "198.51.100.10"))
				.header(HttpHeaders.ORIGIN, "http://localhost:5173")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));

		mockMvc.perform(options("/api/v1/ingredients")
				.with(request -> withRemoteAddress(request, "198.51.100.11"))
				.header(HttpHeaders.ORIGIN, "https://evil.example")
				.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
				.andExpect(status().isForbidden())
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	@Test
	void rejectsOversizedRequestBodyWith413() throws Exception {
		var oversizedDescription = "x".repeat(400);

		mockMvc.perform(post("/api/v1/ingredients")
				.with(request -> withRemoteAddress(request, "198.51.100.20"))
				.with(user("user@example.com").roles("USER"))
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name":"Arroz","description":"%s","defaultUnit":"GRAM"}
						""".formatted(oversizedDescription)))
				.andExpect(status().is(413))
				.andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
	}

	@Test
	void rateLimitsApiByRemoteAddress() throws Exception {
		for (int requestNumber = 0; requestNumber < 2; requestNumber++) {
			mockMvc.perform(get("/api/v1/ingredients")
					.with(request -> withRemoteAddress(request, "198.51.100.30"))
					.with(user("user@example.com").roles("USER")))
					.andExpect(status().isOk());
		}

		mockMvc.perform(get("/api/v1/ingredients")
				.with(request -> withRemoteAddress(request, "198.51.100.30"))
				.with(user("user@example.com").roles("USER")))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("RATE_LIMIT_EXCEEDED"));
	}

	@Test
	void rejectsMatrixParametersBeforeAuthenticationRouting() throws Exception {
		mockMvc.perform(post("/api/v1/auth/login;matrix=x")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"user@example.com","password":"invalid-password"}
						"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void rejectsInvalidCharacterEncodingSafely() throws Exception {
		mockMvc.perform(post("/api/v1/auth/login")
				.contentType("application/json;charset=definitely-not-a-charset")
				.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_CHARACTER_ENCODING"));
	}

	private <T extends org.springframework.mock.web.MockHttpServletRequest> T withRemoteAddress(
			T request, String remoteAddress) {
		request.setRemoteAddr(remoteAddress);
		return request;
	}
}
