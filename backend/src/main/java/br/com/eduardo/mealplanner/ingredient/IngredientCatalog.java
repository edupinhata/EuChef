package br.com.eduardo.mealplanner.ingredient;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface IngredientCatalog {
	Map<Long, IngredientReference> requireAll(Collection<Long> ids);

	default IngredientReference require(Long id) {
		return requireAll(List.of(id)).get(id);
	}
}
