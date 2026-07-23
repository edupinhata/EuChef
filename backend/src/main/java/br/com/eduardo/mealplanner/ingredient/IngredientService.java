package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.EntityNotFoundException;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import br.com.eduardo.mealplanner.web.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class IngredientService {

	private final IngredientRepository repository;

	IngredientService(IngredientRepository repository) {
		this.repository = repository;
	}

	@Transactional
	IngredientResponse create(IngredientRequest request) {
		String name = normalizeName(request.name());
		ensureUniqueName(name, null);
		Ingredient ingredient = new Ingredient(name, normalize(request.description()),
				request.defaultUnit(), toNutrition(request), toSeasonality(request));
		return toResponse(repository.saveAndFlush(ingredient));
	}

	@Transactional(readOnly = true)
	PagedResponse<IngredientResponse> list(String query, int page, int size) {
		String normalizedQuery = escapeLikePattern(query == null ? "" : query.trim());
		Page<IngredientResponse> result = repository.searchByNameFragment(normalizedQuery, PageRequest.of(page, size))
				.map(this::toResponse);
		return PagedResponse.from(result);
	}

	@Transactional(readOnly = true)
	IngredientResponse get(Long id) {
		return toResponse(find(id));
	}

	@Transactional
	IngredientResponse update(Long id, IngredientRequest request) {
		Ingredient ingredient = find(id);
		String name = normalizeName(request.name());
		ensureUniqueName(name, id);
		ingredient.update(name, normalize(request.description()), request.defaultUnit(),
				toNutrition(request), toSeasonality(request));
		return toResponse(repository.saveAndFlush(ingredient));
	}

	@Transactional
	void delete(Long id) {
		repository.delete(find(id));
	}

	private Ingredient find(Long id) {
		return repository.findById(id)
				.orElseThrow(() -> new EntityNotFoundException("Ingrediente não encontrado"));
	}

	private NutritionFacts toNutrition(IngredientRequest request) {
		return request.nutritionPer100g() == null ? null : new NutritionFacts(
				request.nutritionPer100g().caloriesKcal(),
				request.nutritionPer100g().proteinGrams(),
				request.nutritionPer100g().carbohydrateGrams(),
				request.nutritionPer100g().fatGrams(),
				request.nutritionPer100g().fiberGrams(),
				request.nutritionPer100g().sodiumMilligrams());
	}

	private Seasonality toSeasonality(IngredientRequest request) {
		return request.seasonality() == null ? null : new Seasonality(
				request.seasonality().startMonth(), request.seasonality().endMonth());
	}

	private IngredientResponse toResponse(Ingredient ingredient) {
		IngredientResponse.NutritionResponse nutrition = ingredient.nutritionFacts() == null
				? null : new IngredientResponse.NutritionResponse(
				ingredient.nutritionFacts().caloriesKcal(),
				ingredient.nutritionFacts().proteinGrams(),
				ingredient.nutritionFacts().carbohydrateGrams(),
				ingredient.nutritionFacts().fatGrams(),
				ingredient.nutritionFacts().fiberGrams(),
				ingredient.nutritionFacts().sodiumMilligrams());
		IngredientResponse.SeasonalityResponse seasonality = ingredient.seasonality() == null
				? null : new IngredientResponse.SeasonalityResponse(
				ingredient.seasonality().startMonth(), ingredient.seasonality().endMonth());
		return new IngredientResponse(ingredient.id(), ingredient.name(), ingredient.description(),
				ingredient.defaultUnit(), nutrition, seasonality, ingredient.createdAt(), ingredient.updatedAt());
	}

	private void ensureUniqueName(String name, Long currentId) {
		boolean duplicate = currentId == null
				? repository.existsByNameIgnoreCase(name)
				: repository.existsByNameIgnoreCaseAndIdNot(name, currentId);
		if (duplicate) {
			throw new DuplicateResourceException("Já existe um ingrediente com este nome");
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
