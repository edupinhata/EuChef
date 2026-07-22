package br.com.eduardo.mealplanner.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

final class RequestPayloadLimitFilter extends OncePerRequestFilter {
	private static final Set<String> METHODS_WITH_BODY = Set.of("POST", "PUT", "PATCH");
	private final int maxBytes;

	RequestPayloadLimitFilter(SecurityProperties properties) {
		long configuredBytes = properties.getMaxRequestSize().toBytes();
		if (configuredBytes < 1 || configuredBytes > Integer.MAX_VALUE - 1) {
			throw new IllegalArgumentException("euchef.security.max-request-size deve estar entre 1B e 2GB");
		}
		this.maxBytes = (int) configuredBytes;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith("/api/")
				|| !METHODS_WITH_BODY.contains(request.getMethod());
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			jakarta.servlet.FilterChain filterChain) throws ServletException, IOException {
		if (!hasValidCharacterEncoding(request)) {
			JsonErrorResponseWriter.write(response, HttpServletResponse.SC_BAD_REQUEST,
					"INVALID_CHARACTER_ENCODING", "O charset da requisição não é válido");
			return;
		}

		if (request.getContentLengthLong() > maxBytes) {
			reject(response);
			return;
		}

		byte[] body = request.getInputStream().readNBytes(maxBytes + 1);
		if (body.length > maxBytes) {
			reject(response);
			return;
		}

		filterChain.doFilter(new CachedBodyRequest(request, body), response);
	}

	private boolean hasValidCharacterEncoding(HttpServletRequest request) {
		try {
			String contentType = request.getContentType();
			if (contentType != null) {
				MediaType.parseMediaType(contentType).getCharset();
			}
			return true;
		} catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private void reject(HttpServletResponse response) throws IOException {
		JsonErrorResponseWriter.write(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE,
				"PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite permitido");
	}

	private static final class CachedBodyRequest extends HttpServletRequestWrapper {
		private final byte[] body;

		private CachedBodyRequest(HttpServletRequest request, byte[] body) {
			super(request);
			this.body = body;
		}

		@Override
		public ServletInputStream getInputStream() {
			var input = new ByteArrayInputStream(body);
			return new ServletInputStream() {
				@Override
				public int read() {
					return input.read();
				}

				@Override
				public boolean isFinished() {
					return input.available() == 0;
				}

				@Override
				public boolean isReady() {
					return true;
				}

				@Override
				public void setReadListener(ReadListener readListener) {
					throw new UnsupportedOperationException("Leitura assíncrona não suportada");
				}
			};
		}

		@Override
		public BufferedReader getReader() {
			String encoding = getCharacterEncoding();
			Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
			return new BufferedReader(new InputStreamReader(getInputStream(), charset));
		}

		@Override
		public int getContentLength() {
			return body.length;
		}

		@Override
		public long getContentLengthLong() {
			return body.length;
		}
	}
}
