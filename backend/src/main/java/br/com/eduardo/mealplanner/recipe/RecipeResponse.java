package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.MeasurementUnit;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RecipeResponse(
		Long id,
		String name,
		String description,
		Integer servings,
		Integer preparationTimeMinutes,
		List<RecipeIngredientResponse> ingredients,
		List<RecipeStepResponse> preparationSteps,
		Instant createdAt,
		Instant updatedAt) {

	public record RecipeIngredientResponse(
			Long ingredientId,
			String ingredientName,
			BigDecimal quantity,
			MeasurementUnit unit,
			String notes) {
	}

	public record RecipeStepResponse(Integer position, String instruction) {
	}
}
