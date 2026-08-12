package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.IngredientCatalog;
import br.com.eduardo.mealplanner.ingredient.IngredientReference;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import br.com.eduardo.mealplanner.web.PagedResponse;
import jakarta.persistence.EntityNotFoundException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class RecipeService implements RecipeCatalog {

	private final RecipeRepository repository;
	private final IngredientCatalog ingredientCatalog;

	RecipeService(RecipeRepository repository, IngredientCatalog ingredientCatalog) {
		this.repository = repository;
		this.ingredientCatalog = ingredientCatalog;
	}

	@Transactional
	RecipeResponse create(RecipeRequest request) {
		String name = normalizeName(request.name());
		ensureUniqueName(name, null);
		Map<Long, IngredientReference> ingredientReferences = validateIngredients(request);
		Recipe recipe = new Recipe(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes());
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe), ingredientReferences);
	}

	@Transactional(readOnly = true)
	PagedResponse<RecipeSummaryResponse> list(String query, int page, int size) {
		String normalizedQuery = escapeLikePattern(query == null ? "" : query.trim());
		Page<RecipeSummaryResponse> result = repository
				.searchByNameFragment(normalizedQuery, PageRequest.of(page, size))
				.map(this::toSummary);
		return PagedResponse.from(result);
	}

	@Transactional(readOnly = true)
	RecipeResponse get(Long id) {
		return toResponse(find(id));
	}

	@Override
	@Transactional(readOnly = true)
	public Map<Long, RecipeSummaryResponse> requireSummaries(Collection<Long> ids) {
		return requireSummaries(ids, repository::findAllById);
	}

	@Override
	@Transactional
	public Map<Long, RecipeSummaryResponse> requireSummariesForUpdate(Collection<Long> ids) {
		return requireSummaries(ids, repository::findAllByIdWithSharedLock);
	}

	private Map<Long, RecipeSummaryResponse> requireSummaries(Collection<Long> ids,
			Function<Set<Long>, Iterable<Recipe>> finder) {
		Set<Long> requestedIds = new LinkedHashSet<>(ids);
		if (requestedIds.isEmpty()) {
			return Map.of();
		}
		Map<Long, RecipeSummaryResponse> summaries = new LinkedHashMap<>();
		finder.apply(requestedIds)
				.forEach(recipe -> summaries.put(recipe.id(), toSummary(recipe)));
		if (summaries.size() != requestedIds.size()) {
			throw new EntityNotFoundException("Receita não encontrada");
		}
		return summaries;
	}

	@Transactional
	RecipeResponse update(Long id, RecipeRequest request) {
		Recipe recipe = find(id);
		String name = normalizeName(request.name());
		ensureUniqueName(name, id);
		Map<Long, IngredientReference> ingredientReferences = validateIngredients(request);

		recipe.replaceDetails(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes());
		repository.flush();
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe), ingredientReferences);
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

	private Map<Long, IngredientReference> validateIngredients(RecipeRequest request) {
		return ingredientCatalog.requireAll(request.ingredients().stream()
				.map(RecipeRequest.RecipeIngredientRequest::ingredientId)
				.toList());
	}

	private void addContents(Recipe recipe, RecipeRequest request) {
		for (int index = 0; index < request.ingredients().size(); index++) {
			RecipeRequest.RecipeIngredientRequest item = request.ingredients().get(index);
			recipe.addIngredient(item.ingredientId(), index + 1, item.quantity(), item.unit(),
					normalize(item.notes()));
		}
		for (int index = 0; index < request.preparationSteps().size(); index++) {
			recipe.addStep(index + 1, request.preparationSteps().get(index).trim());
		}
	}

	private RecipeResponse toResponse(Recipe recipe) {
		Map<Long, IngredientReference> ingredientReferences = ingredientCatalog.requireAll(recipe.ingredients().stream()
				.map(RecipeIngredient::ingredientId)
				.toList());
		return toResponse(recipe, ingredientReferences);
	}

	private RecipeResponse toResponse(Recipe recipe, Map<Long, IngredientReference> ingredientReferences) {
		List<RecipeResponse.RecipeIngredientResponse> ingredients = recipe.ingredients().stream()
				.map(item -> {
					IngredientReference ingredient = ingredientReferences.get(item.ingredientId());
					return new RecipeResponse.RecipeIngredientResponse(item.ingredientId(), ingredient.name(),
							item.quantity(), item.unit(), item.notes());
				})
				.toList();
		List<RecipeResponse.RecipeStepResponse> steps = recipe.steps().stream()
				.map(step -> new RecipeResponse.RecipeStepResponse(step.position(), step.instruction()))
				.toList();
		return new RecipeResponse(recipe.id(), recipe.name(), recipe.description(), recipe.servings(),
				recipe.preparationTimeMinutes(), ingredients, steps, recipe.createdAt(), recipe.updatedAt());
	}

	private RecipeSummaryResponse toSummary(Recipe recipe) {
		return new RecipeSummaryResponse(recipe.id(), recipe.name(), recipe.description(), recipe.servings(),
				recipe.preparationTimeMinutes(), recipe.createdAt(), recipe.updatedAt());
	}

	private void ensureUniqueName(String name, Long currentId) {
		boolean duplicate = currentId == null
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

	private String escapeLikePattern(String value) {
		return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
	}
}
