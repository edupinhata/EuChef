package br.com.eduardo.mealplanner.security;

import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.firewall.HttpFirewall;
import org.springframework.security.web.firewall.StrictHttpFirewall;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableConfigurationProperties(SecurityProperties.class)
class SecurityConfiguration {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(12);
	}

	@Bean
	AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
		return configuration.getAuthenticationManager();
	}

	@Bean
	SecurityContextRepository securityContextRepository() {
		return new DelegatingSecurityContextRepository(
				new RequestAttributeSecurityContextRepository(),
				new HttpSessionSecurityContextRepository());
	}

	@Bean
	UrlBasedCorsConfigurationSource corsConfigurationSource(SecurityProperties properties) {
		var configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(properties.getAllowedOrigins());
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Accept", "Content-Type", "X-CSRF-TOKEN"));
		configuration.setAllowCredentials(true);
		configuration.setMaxAge(3_600L);

		var source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

	@Bean
	RequestPayloadLimitFilter requestPayloadLimitFilter(SecurityProperties properties) {
		return new RequestPayloadLimitFilter(properties);
	}

	@Bean
	RateLimitFilter rateLimitFilter(SecurityProperties properties) {
		return new RateLimitFilter(properties);
	}

	@Bean
	HttpFirewall httpFirewall() {
		var firewall = new StrictHttpFirewall();
		firewall.setAllowSemicolon(false);
		return firewall;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
			SecurityContextRepository contextRepository,
			RequestPayloadLimitFilter payloadLimitFilter,
			RateLimitFilter rateLimitFilter,
			@Value("${server.servlet.session.cookie.name:JSESSIONID}") String sessionCookieName,
			@Value("${server.servlet.session.cookie.secure:false}") boolean secureSessionCookie) throws Exception {
		http
				.csrf(csrf -> {})
				.cors(cors -> {})
				.securityContext(context -> context.securityContextRepository(contextRepository))
				.sessionManagement(session -> session
						.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
						.sessionFixation(fixation -> fixation.changeSessionId()))
				.requestCache(cache -> cache.disable())
				.formLogin(form -> form.disable())
				.httpBasic(basic -> basic.disable())
				.logout(logout -> logout
						.logoutUrl("/api/v1/auth/logout")
						.invalidateHttpSession(true)
						.clearAuthentication(true)
						.logoutSuccessHandler((request, response, authentication) -> {
							var expiredCookie = ResponseCookie.from(sessionCookieName, "")
									.path("/")
									.httpOnly(true)
									.secure(secureSessionCookie)
									.sameSite("Lax")
									.maxAge(Duration.ZERO)
									.build();
							response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
							response.setStatus(204);
						}))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/actuator/health", "/api/v1/auth/csrf",
								"/api/v1/auth/register", "/api/v1/auth/login").permitAll()
						.requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").hasRole("ADMIN")
						.requestMatchers("/actuator/info").hasRole("ADMIN")
						.requestMatchers("/api/**").authenticated()
						.anyRequest().denyAll())
				.exceptionHandling(errors -> errors
						.authenticationEntryPoint((request, response, exception) ->
								JsonErrorResponseWriter.write(response, 401,
										"AUTHENTICATION_REQUIRED", "Autenticação obrigatória"))
						.accessDeniedHandler((request, response, exception) -> {
							if (exception instanceof MissingCsrfTokenException
									|| exception instanceof InvalidCsrfTokenException) {
								JsonErrorResponseWriter.write(response, 403,
										"INVALID_CSRF_TOKEN", "Token CSRF ausente ou inválido");
								return;
							}
							JsonErrorResponseWriter.write(response, 403,
									"ACCESS_DENIED", "Acesso não autorizado");
						}))
				.headers(headers -> headers
						.contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
						.referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER))
						.addHeaderWriter(new StaticHeadersWriter(
								"Permissions-Policy", "camera=(), geolocation=(), microphone=()"))
						.frameOptions(frame -> frame.deny()))
				.addFilterBefore(rateLimitFilter, CsrfFilter.class)
				.addFilterBefore(payloadLimitFilter, RateLimitFilter.class);

		return http.build();
	}
}
