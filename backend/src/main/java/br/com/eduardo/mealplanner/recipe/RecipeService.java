package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.IngredientCatalog;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class RecipeService {

	private final RecipeRepository repository;
	private final IngredientCatalog ingredientCatalog;

	RecipeService(RecipeRepository repository, IngredientCatalog ingredientCatalog) {
		this.repository = repository;
		this.ingredientCatalog = ingredientCatalog;
	}

	@Transactional
	RecipeResponse create(RecipeRequest request) {
		var name = normalizeName(request.name());
		ensureUniqueName(name, null);
		validateIngredients(request);
		var recipe = new Recipe(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes());
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe));
	}

	@Transactional(readOnly = true)
	List<RecipeResponse> list() {
		return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	RecipeResponse get(Long id) {
		return toResponse(find(id));
	}

	@Transactional
	RecipeResponse update(Long id, RecipeRequest request) {
		var recipe = find(id);
		var name = normalizeName(request.name());
		ensureUniqueName(name, id);
		validateIngredients(request);

		recipe.replaceDetails(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes());
		repository.flush();
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe));
	}

	@Transactional
	void delete(Long id) {
		repository.delete(find(id));
		repository.flush();
	}

	private Recipe find(Long id) {
		return repository.findById(id)
				.orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
	}

	private void validateIngredients(RecipeRequest request) {
		request.ingredients().forEach(item -> ingredientCatalog.require(item.ingredientId()));
	}

	private void addContents(Recipe recipe, RecipeRequest request) {
		for (int index = 0; index < request.ingredients().size(); index++) {
			var item = request.ingredients().get(index);
			recipe.addIngredient(item.ingredientId(), index + 1, item.quantity(), item.unit(),
					normalize(item.notes()));
		}
		for (int index = 0; index < request.preparationSteps().size(); index++) {
			recipe.addStep(index + 1, request.preparationSteps().get(index).trim());
		}
	}

	private RecipeResponse toResponse(Recipe recipe) {
		List<RecipeResponse.RecipeIngredientResponse> ingredients = recipe.ingredients().stream()
				.map(item -> {
					var ingredient = ingredientCatalog.require(item.ingredientId());
					return new RecipeResponse.RecipeIngredientResponse(item.ingredientId(), ingredient.name(),
							item.quantity(), item.unit(), item.notes());
				})
				.toList();
		var steps = recipe.steps().stream()
				.map(step -> new RecipeResponse.RecipeStepResponse(step.position(), step.instruction()))
				.toList();
		return new RecipeResponse(recipe.id(), recipe.name(), recipe.description(), recipe.servings(),
				recipe.preparationTimeMinutes(), ingredients, steps, recipe.createdAt(), recipe.updatedAt());
	}

	private void ensureUniqueName(String name, Long currentId) {
		var duplicate = currentId == null
				? repository.existsByNameIgnoreCase(name)
				: repository.existsByNameIgnoreCaseAndIdNot(name, currentId);
		if (duplicate) {
			throw new DuplicateResourceException("Já existe uma receita com este nome");
		}
	}

	private String normalizeName(String value) {
		return value.trim().replaceAll("\\s+", " ");
	}

	private String normalize(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
