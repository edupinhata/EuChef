package br.com.eduardo.mealplanner.ingredient;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record IngredientRequest(
		@NotBlank @Size(min = 2, max = 120) String name,
		@Size(max = 1000) String description,
		@NotNull MeasurementUnit defaultUnit,
		@Valid NutritionRequest nutritionPer100g,
		@Valid SeasonalityRequest seasonality) {

	public record NutritionRequest(
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal caloriesKcal,
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal proteinGrams,
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal carbohydrateGrams,
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal fatGrams,
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal fiberGrams,
			@DecimalMin("0.0") @Digits(integer = 8, fraction = 2) BigDecimal sodiumMilligrams) {
	}

	public record SeasonalityRequest(
			@NotNull @Min(1) @Max(12) Integer startMonth,
			@NotNull @Min(1) @Max(12) Integer endMonth) {
	}
}
