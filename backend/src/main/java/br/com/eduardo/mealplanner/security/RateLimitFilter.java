package br.com.eduardo.mealplanner.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

final class RateLimitFilter extends OncePerRequestFilter {
	private static final String AUTH_PREFIX = "/api/v1/auth/";
	private static final String LOGIN_PATH = AUTH_PREFIX + "login";
	private static final String REGISTER_PATH = AUTH_PREFIX + "register";
	private final SecurityProperties.RateLimit properties;
	private final Clock clock;
	private final Map<ClientKey, Window> windows = new ConcurrentHashMap<>();
	private final AtomicLong requestCounter = new AtomicLong();

	RateLimitFilter(SecurityProperties properties) {
		this(properties, Clock.systemUTC());
	}

	RateLimitFilter(SecurityProperties properties, Clock clock) {
		this.properties = properties.getRateLimit();
		this.clock = clock;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith("/api/") || "OPTIONS".equals(request.getMethod());
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			jakarta.servlet.FilterChain filterChain) throws ServletException, IOException {
		if (hasMatrixParameter(request.getRequestURI())) {
			JsonErrorResponseWriter.write(response, 400, "INVALID_PATH",
					"O caminho da requisição não é válido");
			return;
		}

		long now = clock.millis();
		if ((requestCounter.incrementAndGet() & 255) == 0) {
			windows.entrySet().removeIf(entry -> entry.getValue().expiredAt(now));
		}

		Bucket bucket = isAuthenticationAttempt(request.getRequestURI()) ? Bucket.AUTH : Bucket.API;
		ClientKey key = new ClientKey(request.getRemoteAddr(), bucket);
		Window window = windows.get(key);
		if (window == null) {
			if (windows.size() >= properties.getMaxClients()) {
				windows.entrySet().removeIf(entry -> entry.getValue().expiredAt(now));
			}
			if (windows.size() >= properties.getMaxClients()) {
				reject(response, properties.getWindow());
				return;
			}
			window = windows.computeIfAbsent(key,
					ignored -> new Window(now + properties.getWindow().toMillis()));
		}

		int limit = bucket == Bucket.AUTH ? properties.getAuthRequests() : properties.getApiRequests();
		long retryAfterMillis = window.acquire(now, limit, properties.getWindow());
		if (retryAfterMillis > 0) {
			reject(response, Duration.ofMillis(retryAfterMillis));
			return;
		}

		filterChain.doFilter(request, response);
	}

	private boolean isAuthenticationAttempt(String path) {
		return LOGIN_PATH.equals(path) || REGISTER_PATH.equals(path);
	}

	private boolean hasMatrixParameter(String path) {
		var lowerCasePath = path.toLowerCase(Locale.ROOT);
		return lowerCasePath.indexOf(';') >= 0 || lowerCasePath.contains("%3b");
	}

	private void reject(HttpServletResponse response, Duration retryAfter) throws IOException {
		long retryAfterSeconds = Math.max(1, (retryAfter.toMillis() + 999) / 1_000);
		response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
		JsonErrorResponseWriter.write(response, 429, "RATE_LIMIT_EXCEEDED",
				"Limite de requisições excedido; tente novamente mais tarde");
	}

	private enum Bucket { API, AUTH }

	private record ClientKey(String remoteAddress, Bucket bucket) {
	}

	private static final class Window {
		private long resetAt;
		private int count;

		private Window(long resetAt) {
			this.resetAt = resetAt;
		}

		private synchronized long acquire(long now, int limit, Duration duration) {
			if (now >= resetAt) {
				resetAt = now + duration.toMillis();
				count = 0;
			}
			if (count >= limit) {
				return resetAt - now;
			}
			count++;
			return 0;
		}

		private synchronized boolean expiredAt(long now) {
			return now >= resetAt;
		}
	}
}
