package br.com.eduardo.mealplanner.recipe;

public class RecipeAccessDeniedException extends RuntimeException {

	public RecipeAccessDeniedException() {
		super("Você não tem permissão para alterar esta receita");
	}
}