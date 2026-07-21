package br.com.eduardo.mealplanner.recipe;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "recipes")
class Recipe {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String name;
	private String description;
	private int servings;
	private int preparationTimeMinutes;

	@OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position ASC")
	private List<RecipeIngredient> ingredients = new ArrayList<>();

	@OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position ASC")
	private List<RecipeStep> steps = new ArrayList<>();

	@Version
	private long version;

	@CreationTimestamp
	private Instant createdAt;

	@UpdateTimestamp
	private Instant updatedAt;

	protected Recipe() {
	}

	Recipe(String name, String description, int servings, int preparationTimeMinutes) {
		this.name = name;
		this.description = description;
		this.servings = servings;
		this.preparationTimeMinutes = preparationTimeMinutes;
	}

	void replaceDetails(String name, String description, int servings, int preparationTimeMinutes) {
		this.name = name;
		this.description = description;
		this.servings = servings;
		this.preparationTimeMinutes = preparationTimeMinutes;
		ingredients.clear();
		steps.clear();
	}

	void addIngredient(Long ingredientId, int position, java.math.BigDecimal quantity,
			br.com.eduardo.mealplanner.ingredient.MeasurementUnit unit, String notes) {
		ingredients.add(new RecipeIngredient(this, ingredientId, position, quantity, unit, notes));
	}

	void addStep(int position, String instruction) {
		steps.add(new RecipeStep(this, position, instruction));
	}

	Long id() { return id; }
	String name() { return name; }
	String description() { return description; }
	int servings() { return servings; }
	int preparationTimeMinutes() { return preparationTimeMinutes; }
	List<RecipeIngredient> ingredients() { return ingredients; }
	List<RecipeStep> steps() { return steps; }
	Instant createdAt() { return createdAt; }
	Instant updatedAt() { return updatedAt; }
}
