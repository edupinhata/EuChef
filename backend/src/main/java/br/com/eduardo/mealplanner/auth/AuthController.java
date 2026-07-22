package br.com.eduardo.mealplanner.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.web.csrf.CsrfToken;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

	private final AuthService service;
	private final AuthenticationManager authenticationManager;
	private final SecurityContextRepository securityContextRepository;

	AuthController(AuthService service, AuthenticationManager authenticationManager,
			SecurityContextRepository securityContextRepository) {
		this.service = service;
		this.authenticationManager = authenticationManager;
		this.securityContextRepository = securityContextRepository;
	}

	@PostMapping("/register")
	ResponseEntity<AuthenticatedUserResponse> register(@Valid @RequestBody RegistrationRequest request) {
		return ResponseEntity.created(URI.create("/api/v1/auth/me")).body(service.register(request));
	}

	@PostMapping("/login")
	AuthenticatedUserResponse login(@Valid @RequestBody LoginRequest request,
			HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
		try {
			Authentication authentication = authenticationManager.authenticate(
					new UsernamePasswordAuthenticationToken(AuthService.normalizeEmail(request.email()), request.password()));
			var context = SecurityContextHolder.createEmptyContext();
			context.setAuthentication(authentication);
			SecurityContextHolder.setContext(context);
			if (servletRequest.getSession(false) == null) {
				servletRequest.getSession(true);
			} else {
				servletRequest.changeSessionId();
			}
			securityContextRepository.saveContext(context, servletRequest, servletResponse);
			return service.findAuthenticated(authentication.getName());
		} catch (AuthenticationException exception) {
			throw new InvalidCredentialsException();
		}
	}

	@GetMapping("/me")
	AuthenticatedUserResponse me(Authentication authentication) {
		return service.findAuthenticated(authentication.getName());
	}

	@GetMapping("/csrf")
	CsrfResponse csrf(CsrfToken token) {
		return new CsrfResponse(token.getToken(), token.getHeaderName(), token.getParameterName());
	}

	record CsrfResponse(String token, String headerName, String parameterName) {
	}
}
