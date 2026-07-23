package br.com.eduardo.mealplanner.ingredient;

import java.util.List;

public class IngredientsNotFoundException extends RuntimeException {

	private final List<Long> missingIds;

	public IngredientsNotFoundException(List<Long> missingIds) {
		super("Ingredientes não encontrados: " + missingIds);
		this.missingIds = List.copyOf(missingIds);
	}

	public List<Long> missingIds() {
		return missingIds;
	}
}
