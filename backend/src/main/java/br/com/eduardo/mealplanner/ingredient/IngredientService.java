package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.EntityNotFoundException;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import java.util.List;
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
		var name = normalizeName(request.name());
		ensureUniqueName(name, null);
		var ingredient = new Ingredient(name, normalize(request.description()),
				request.defaultUnit(), toNutrition(request), toSeasonality(request));
		return toResponse(repository.saveAndFlush(ingredient));
	}

	@Transactional(readOnly = true)
	List<IngredientResponse> list() {
		return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	IngredientResponse get(Long id) {
		return toResponse(find(id));
	}

	@Transactional
	IngredientResponse update(Long id, IngredientRequest request) {
		var ingredient = find(id);
		var name = normalizeName(request.name());
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
		var nutrition = ingredient.nutritionFacts() == null ? null : new IngredientResponse.NutritionResponse(
				ingredient.nutritionFacts().caloriesKcal(),
				ingredient.nutritionFacts().proteinGrams(),
				ingredient.nutritionFacts().carbohydrateGrams(),
				ingredient.nutritionFacts().fatGrams(),
				ingredient.nutritionFacts().fiberGrams(),
				ingredient.nutritionFacts().sodiumMilligrams());
		var seasonality = ingredient.seasonality() == null ? null : new IngredientResponse.SeasonalityResponse(
				ingredient.seasonality().startMonth(), ingredient.seasonality().endMonth());
		return new IngredientResponse(ingredient.id(), ingredient.name(), ingredient.description(),
				ingredient.defaultUnit(), nutrition, seasonality, ingredient.createdAt(), ingredient.updatedAt());
	}

	private void ensureUniqueName(String name, Long currentId) {
		var duplicate = currentId == null
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
}
