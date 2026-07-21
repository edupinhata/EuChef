package br.com.eduardo.mealplanner.recipe;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "recipe_steps")
class RecipeStep {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "recipe_id")
	private Recipe recipe;

	private int position;
	private String instruction;

	protected RecipeStep() {
	}

	RecipeStep(Recipe recipe, int position, String instruction) {
		this.recipe = recipe;
		this.position = position;
		this.instruction = instruction;
	}

	int position() { return position; }
	String instruction() { return instruction; }
}
