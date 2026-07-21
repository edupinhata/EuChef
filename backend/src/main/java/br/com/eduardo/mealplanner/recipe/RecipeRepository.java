package br.com.eduardo.mealplanner.recipe;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface RecipeRepository extends JpaRepository<Recipe, Long> {
	List<Recipe> findAllByOrderByNameAsc();
	boolean existsByNameIgnoreCase(String name);
	boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
