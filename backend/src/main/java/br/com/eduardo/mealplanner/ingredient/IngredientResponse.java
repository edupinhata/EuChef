package br.com.eduardo.mealplanner.ingredient;

import java.math.BigDecimal;
import java.time.Instant;

public record IngredientResponse(
		Long id,
		String name,
		String description,
		MeasurementUnit defaultUnit,
		NutritionResponse nutritionPer100g,
		SeasonalityResponse seasonality,
		Instant createdAt,
		Instant updatedAt) {

	public record NutritionResponse(
			BigDecimal caloriesKcal,
			BigDecimal proteinGrams,
			BigDecimal carbohydrateGrams,
			BigDecimal fatGrams,
			BigDecimal fiberGrams,
			BigDecimal sodiumMilligrams) {
	}

	public record SeasonalityResponse(Integer startMonth, Integer endMonth) {
	}
}
