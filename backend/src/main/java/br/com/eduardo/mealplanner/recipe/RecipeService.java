package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.auth.UserIdentity;
import br.com.eduardo.mealplanner.auth.UserIdentityProvider;
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
	private final UserIdentityProvider userIdentityProvider;

	RecipeService(RecipeRepository repository, IngredientCatalog ingredientCatalog,
			UserIdentityProvider userIdentityProvider) {
		this.repository = repository;
		this.ingredientCatalog = ingredientCatalog;
		this.userIdentityProvider = userIdentityProvider;
	}

	@Transactional
	RecipeResponse create(String email, RecipeRequest request) {
		UserIdentity author = userIdentityProvider.requireUser(email);
		String name = normalizeName(request.name());
		ensureUniqueName(name, null);
		Map<Long, IngredientReference> ingredientReferences = validateIngredients(request);
		Recipe recipe = new Recipe(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes(), normalize(request.youtubeVideoUrl()), author.id());
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe), ingredientReferences, author);
	}

	@Transactional(readOnly = true)
	PagedResponse<RecipeSummaryResponse> list(String query, int page, int size) {
		String normalizedQuery = escapeLikePattern(query == null ? "" : query.trim());
		Page<Recipe> recipes = repository.searchByNameFragment(normalizedQuery, PageRequest.of(page, size));
		Map<Long, UserIdentity> authors = requireAuthors(recipes.getContent());
		Page<RecipeSummaryResponse> result = recipes.map(recipe -> toSummary(recipe, authors.get(recipe.authorId())));
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
		List<Recipe> recipes = new java.util.ArrayList<>();
		finder.apply(requestedIds).forEach(recipes::add);
		Map<Long, UserIdentity> authors = requireAuthors(recipes);
		Map<Long, RecipeSummaryResponse> summaries = new LinkedHashMap<>();
		recipes.forEach(recipe -> summaries.put(recipe.id(), toSummary(recipe, authors.get(recipe.authorId()))));
		if (summaries.size() != requestedIds.size()) {
			throw new EntityNotFoundException("Receita não encontrada");
		}
		return summaries;
	}

	@Transactional
	RecipeResponse update(String email, boolean administrator, Long id, RecipeRequest request) {
		Recipe recipe = find(id);
		UserIdentity user = userIdentityProvider.requireUser(email);
		ensureCanChange(recipe, user.id(), administrator);
		String name = normalizeName(request.name());
		ensureUniqueName(name, id);
		Map<Long, IngredientReference> ingredientReferences = validateIngredients(request);

		recipe.replaceDetails(name, normalize(request.description()), request.servings(),
				request.preparationTimeMinutes(), normalize(request.youtubeVideoUrl()));
		repository.flush();
		addContents(recipe, request);
		return toResponse(repository.saveAndFlush(recipe), ingredientReferences,
				userIdentityProvider.requireUsers(List.of(recipe.authorId())).get(recipe.authorId()));
	}

	@Transactional
	void delete(String email, boolean administrator, Long id) {
		Recipe recipe = find(id);
		ensureCanChange(recipe, userIdentityProvider.requireUser(email).id(), administrator);
		repository.delete(recipe);
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
		UserIdentity author = userIdentityProvider.requireUsers(List.of(recipe.authorId())).get(recipe.authorId());
		return toResponse(recipe, ingredientReferences, author);
	}

	private RecipeResponse toResponse(Recipe recipe, Map<Long, IngredientReference> ingredientReferences,
			UserIdentity author) {
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
				recipe.preparationTimeMinutes(), recipe.youtubeVideoUrl(), author, ingredients, steps, recipe.createdAt(),
				recipe.updatedAt());
	}

	private RecipeSummaryResponse toSummary(Recipe recipe, UserIdentity author) {
		return new RecipeSummaryResponse(recipe.id(), recipe.name(), recipe.description(), recipe.servings(),
				recipe.preparationTimeMinutes(), author, recipe.createdAt(), recipe.updatedAt());
	}

	private Map<Long, UserIdentity> requireAuthors(Collection<Recipe> recipes) {
		return userIdentityProvider.requireUsers(recipes.stream().map(Recipe::authorId).collect(java.util.stream.Collectors.toSet()));
	}

	private void ensureCanChange(Recipe recipe, Long userId, boolean administrator) {
		if (!administrator && !java.util.Objects.equals(recipe.authorId(), userId)) {
			throw new RecipeAccessDeniedException();
		}
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
