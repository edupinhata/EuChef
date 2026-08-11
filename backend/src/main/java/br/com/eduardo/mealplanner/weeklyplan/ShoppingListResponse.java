package br.com.eduardo.mealplanner.weeklyplan;

import br.com.eduardo.mealplanner.ingredient.MeasurementUnit;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

record ShoppingListResponse(LocalDate weekStart, List<Item> items) {

	record Item(
			Long ingredientId,
			String ingredientName,
			BigDecimal quantity,
			MeasurementUnit unit) {
	}
}
