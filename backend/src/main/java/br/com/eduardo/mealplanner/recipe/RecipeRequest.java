package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.MeasurementUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record RecipeRequest(
		@NotBlank @Size(min = 2, max = 160) String name,
		@Size(max = 1500) String description,
		@NotNull @Min(1) @Max(1000) Integer servings,
		@NotNull @Min(0) @Max(10080) Integer preparationTimeMinutes,
		@NotEmpty @Size(max = 100) List<@Valid RecipeIngredientRequest> ingredients,
		@NotEmpty @Size(max = 100) List<@NotBlank @Size(max = 2000) String> preparationSteps) {

	public record RecipeIngredientRequest(
			@NotNull @Positive Long ingredientId,
			@NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity,
			@NotNull MeasurementUnit unit,
			@Size(max = 500) String notes) {
	}
}
