package br.com.eduardo.mealplanner.web;

import java.time.Instant;
import java.util.Map;

public record ApiError(
		String code,
		String message,
		Instant timestamp,
		Map<String, String> fieldErrors,
		Map<String, Object> details) {
}
