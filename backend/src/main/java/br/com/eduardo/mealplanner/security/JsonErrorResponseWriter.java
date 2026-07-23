package br.com.eduardo.mealplanner.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

final class JsonErrorResponseWriter {
	private JsonErrorResponseWriter() {
	}

	static void write(HttpServletResponse response, int status, String code, String message)
			throws IOException {
		response.setStatus(status);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.setContentType("application/json");
		response.getWriter().write("""
				{"code":"%s","message":"%s","timestamp":"%s","fieldErrors":{},"details":{}}
				""".formatted(code, message, Instant.now()).strip());
	}
}
