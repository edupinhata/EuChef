package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.auth.UserIdentity;
import java.time.Instant;

public record RecipeSummaryResponse(
		Long id,
		String name,
		String description,
		Integer servings,
		Integer preparationTimeMinutes,
		UserIdentity author,
		Instant createdAt,
		Instant updatedAt) {
}
