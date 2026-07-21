package br.com.eduardo.mealplanner.recipe;

import br.com.eduardo.mealplanner.ingredient.MeasurementUnit;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "recipe_ingredients")
class RecipeIngredient {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recipe_id")
	private Recipe recipe;

	private Long ingredientId;
	private int position;
	private BigDecimal quantity;

	@Enumerated(EnumType.STRING)
	private MeasurementUnit unit;

	private String notes;

	protected RecipeIngredient() {
	}

	RecipeIngredient(Recipe recipe, Long ingredientId, int position, BigDecimal quantity,
			MeasurementUnit unit, String notes) {
		this.recipe = recipe;
		this.ingredientId = ingredientId;
		this.position = position;
		this.quantity = quantity;
		this.unit = unit;
		this.notes = notes;
	}

	Long ingredientId() { return ingredientId; }
	int position() { return position; }
	BigDecimal quantity() { return quantity; }
	MeasurementUnit unit() { return unit; }
	String notes() { return notes; }
}
