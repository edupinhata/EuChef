package br.com.eduardo.mealplanner.ingredient;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;

@Service
class JpaIngredientCatalog implements IngredientCatalog {

	private final IngredientRepository repository;

	JpaIngredientCatalog(IngredientRepository repository) {
		this.repository = repository;
	}

	@Override
	public Map<Long, IngredientReference> requireAll(Collection<Long> ids) {
		var requestedIds = new TreeSet<>(ids);
		Map<Long, IngredientReference> references = new LinkedHashMap<>();
		repository.findAllById(requestedIds).forEach(ingredient -> references.put(
				ingredient.id(),
				new IngredientReference(ingredient.id(), ingredient.name(), ingredient.defaultUnit())));

		var missingIds = requestedIds.stream().filter(id -> !references.containsKey(id)).toList();
		if (!missingIds.isEmpty()) {
			throw new IngredientsNotFoundException(missingIds);
		}
		return Map.copyOf(references);
	}
}
