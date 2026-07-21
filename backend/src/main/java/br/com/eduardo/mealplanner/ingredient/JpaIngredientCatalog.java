package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;

@Service
class JpaIngredientCatalog implements IngredientCatalog {

	private final IngredientRepository repository;

	JpaIngredientCatalog(IngredientRepository repository) {
		this.repository = repository;
	}

	@Override
	public IngredientReference require(Long id) {
		return repository.findById(id)
				.map(ingredient -> new IngredientReference(
						ingredient.id(), ingredient.name(), ingredient.defaultUnit()))
				.orElseThrow(() -> new EntityNotFoundException("Ingrediente não encontrado: " + id));
	}
}
