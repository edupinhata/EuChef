package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

@Embeddable
class NutritionFacts {

	@Column(name = "calories_kcal", precision = 10, scale = 2)
	private BigDecimal caloriesKcal;

	@Column(name = "protein_grams", precision = 10, scale = 2)
	private BigDecimal proteinGrams;

	@Column(name = "carbohydrate_grams", precision = 10, scale = 2)
	private BigDecimal carbohydrateGrams;

	@Column(name = "fat_grams", precision = 10, scale = 2)
	private BigDecimal fatGrams;

	@Column(name = "fiber_grams", precision = 10, scale = 2)
	private BigDecimal fiberGrams;

	@Column(name = "sodium_milligrams", precision = 10, scale = 2)
	private BigDecimal sodiumMilligrams;

	protected NutritionFacts() {
	}

	NutritionFacts(BigDecimal caloriesKcal, BigDecimal proteinGrams, BigDecimal carbohydrateGrams,
			BigDecimal fatGrams, BigDecimal fiberGrams, BigDecimal sodiumMilligrams) {
		this.caloriesKcal = caloriesKcal;
		this.proteinGrams = proteinGrams;
		this.carbohydrateGrams = carbohydrateGrams;
		this.fatGrams = fatGrams;
		this.fiberGrams = fiberGrams;
		this.sodiumMilligrams = sodiumMilligrams;
	}

	BigDecimal caloriesKcal() { return caloriesKcal; }
	BigDecimal proteinGrams() { return proteinGrams; }
	BigDecimal carbohydrateGrams() { return carbohydrateGrams; }
	BigDecimal fatGrams() { return fatGrams; }
	BigDecimal fiberGrams() { return fiberGrams; }
	BigDecimal sodiumMilligrams() { return sodiumMilligrams; }
}
