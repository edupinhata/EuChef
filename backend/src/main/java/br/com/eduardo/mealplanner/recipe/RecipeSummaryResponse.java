package br.com.eduardo.mealplanner.recipe;

import java.time.Instant;

public record RecipeSummaryResponse(
		Long id,
		String name,
		String description,
		Integer servings,
		Integer preparationTimeMinutes,
		Instant createdAt,
		Instant updatedAt) {
}
