package br.com.eduardo.mealplanner.weeklyplan;

import br.com.eduardo.mealplanner.recipe.RecipeSummaryResponse;
import java.time.Instant;

record WeeklyPlanRecipeResponse(
		Long id,
		String name,
		String description,
		Integer servings,
		Integer preparationTimeMinutes,
		Instant createdAt,
		Instant updatedAt,
		Integer plannedQuantity) {

	static WeeklyPlanRecipeResponse from(RecipeSummaryResponse recipe, int plannedQuantity) {
		return new WeeklyPlanRecipeResponse(
				recipe.id(),
				recipe.name(),
				recipe.description(),
				recipe.servings(),
				recipe.preparationTimeMinutes(),
				recipe.createdAt(),
				recipe.updatedAt(),
				plannedQuantity);
	}
}
