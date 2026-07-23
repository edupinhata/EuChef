package br.com.eduardo.mealplanner.recipe;

import org.springframework.data.jpa.repository.JpaRepository;

interface RecipeRepository extends JpaRepository<Recipe, Long> {
	boolean existsByNameIgnoreCase(String name);
	boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
