package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.MeasurementUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record RecipeRequest(
		@NotBlank @Size(min = 2, max = 160) String name,
		@Size(max = 1500) String description,
		@NotNull @Min(1) @Max(1000) Integer servings,
		@NotNull @Min(0) @Max(10080) Integer preparationTimeMinutes,
		@Size(max = 500)
		@Pattern(regexp = "^https://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/)[A-Za-z0-9_-]{11}([&#?].*)?$",
				message = "Informe uma URL válida de vídeo do YouTube") String youtubeVideoUrl,
		@NotEmpty @Size(max = 100) List<@Valid @NotNull RecipeIngredientRequest> ingredients,
		@NotEmpty @Size(max = 100) List<@NotBlank @Size(max = 2000) String> preparationSteps) {

	@AssertTrue(message = "Uma receita não pode repetir o mesmo ingrediente")
	public boolean isIngredientIdsUnique() {
		if (ingredients == null) {
			return true;
		}
		Set<Long> ingredientIds = new HashSet<>();
		for (RecipeIngredientRequest ingredient : ingredients) {
			if (ingredient != null && ingredient.ingredientId() != null
					&& !ingredientIds.add(ingredient.ingredientId())) {
				return false;
			}
		}
		return true;
	}

	public record RecipeIngredientRequest(
			@NotNull @Positive Long ingredientId,
			@NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity,
			@NotNull MeasurementUnit unit,
			@Size(max = 500) String notes) {
	}
}
