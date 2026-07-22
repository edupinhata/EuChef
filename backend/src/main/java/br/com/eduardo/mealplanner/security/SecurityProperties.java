package br.com.eduardo.mealplanner.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.convert.DataSizeUnit;
import org.springframework.util.unit.DataSize;
import org.springframework.util.unit.DataUnit;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("euchef.security")
public class SecurityProperties {
	private List<String> allowedOrigins = new ArrayList<>();

	@DataSizeUnit(DataUnit.BYTES)
	private DataSize maxRequestSize = DataSize.ofMegabytes(1);

	@Valid
	private RateLimit rateLimit = new RateLimit();

	public List<String> getAllowedOrigins() {
		return List.copyOf(allowedOrigins);
	}

	public void setAllowedOrigins(List<String> allowedOrigins) {
		this.allowedOrigins = allowedOrigins == null ? new ArrayList<>() : new ArrayList<>(allowedOrigins);
	}

	public DataSize getMaxRequestSize() {
		return maxRequestSize;
	}

	public void setMaxRequestSize(DataSize maxRequestSize) {
		this.maxRequestSize = maxRequestSize;
	}

	public RateLimit getRateLimit() {
		return rateLimit;
	}

	public void setRateLimit(RateLimit rateLimit) {
		this.rateLimit = rateLimit;
	}

	public static class RateLimit {
		@Min(1)
		@Max(10_000)
		private int apiRequests = 120;

		@Min(1)
		@Max(1_000)
		private int authRequests = 10;

		@NotNull
		private Duration window = Duration.ofMinutes(1);

		@Min(100)
		@Max(1_000_000)
		private int maxClients = 10_000;

		public int getApiRequests() {
			return apiRequests;
		}

		public void setApiRequests(int apiRequests) {
			this.apiRequests = apiRequests;
		}

		public int getAuthRequests() {
			return authRequests;
		}

		public void setAuthRequests(int authRequests) {
			this.authRequests = authRequests;
		}

		public Duration getWindow() {
			return window;
		}

		public void setWindow(Duration window) {
			this.window = window;
		}

		@AssertTrue(message = "a janela do rate limit deve estar entre 1 segundo e 24 horas")
		public boolean isWindowWithinAllowedRange() {
			return window != null
					&& window.compareTo(Duration.ofSeconds(1)) >= 0
					&& window.compareTo(Duration.ofHours(24)) <= 0;
		}

		public int getMaxClients() {
			return maxClients;
		}

		public void setMaxClients(int maxClients) {
			this.maxClients = maxClients;
		}
	}
}
