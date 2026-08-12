package br.com.eduardo.mealplanner.weeklyplan;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

record WeeklyPlanRecipeRequest(
		@NotNull @Positive Long recipeId,
		@Positive @DecimalMax("100") @Digits(integer = 3, fraction = 0) BigDecimal quantity) {

	int quantityOrDefault() {
		return quantity == null ? 1 : quantity.intValueExact();
	}
}
