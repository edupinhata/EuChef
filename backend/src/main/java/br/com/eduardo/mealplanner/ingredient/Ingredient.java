package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "ingredients")
class Ingredient {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String name;

	private String description;

	@Enumerated(EnumType.STRING)
	private MeasurementUnit defaultUnit;

	@Embedded
	private NutritionFacts nutritionFacts;

	@Embedded
	private Seasonality seasonality;

	@Version
	private long version;

	@CreationTimestamp
	private Instant createdAt;

	@UpdateTimestamp
	private Instant updatedAt;

	protected Ingredient() {
	}

	Ingredient(String name, String description, MeasurementUnit defaultUnit,
			NutritionFacts nutritionFacts, Seasonality seasonality) {
		this.name = name;
		this.description = description;
		this.defaultUnit = defaultUnit;
		this.nutritionFacts = nutritionFacts;
		this.seasonality = seasonality;
	}

	Long id() { return id; }
	String name() { return name; }
	String description() { return description; }
	MeasurementUnit defaultUnit() { return defaultUnit; }
	NutritionFacts nutritionFacts() { return nutritionFacts; }
	Seasonality seasonality() { return seasonality; }
	Instant createdAt() { return createdAt; }
	Instant updatedAt() { return updatedAt; }

	void update(String name, String description, MeasurementUnit defaultUnit,
			NutritionFacts nutritionFacts, Seasonality seasonality) {
		this.name = name;
		this.description = description;
		this.defaultUnit = defaultUnit;
		this.nutritionFacts = nutritionFacts;
		this.seasonality = seasonality;
	}
}
