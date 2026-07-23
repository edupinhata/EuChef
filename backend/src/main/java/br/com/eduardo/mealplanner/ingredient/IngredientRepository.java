package br.com.eduardo.mealplanner.ingredient;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface IngredientRepository extends JpaRepository<Ingredient, Long> {
	@Query("""
			select ingredient from Ingredient ingredient
			where lower(ingredient.name) like concat(lower(:query), '%') escape '!'
			order by lower(ingredient.name), ingredient.id
			""")
	Page<Ingredient> searchByNamePrefix(@Param("query") String query, Pageable pageable);
	boolean existsByNameIgnoreCase(String name);
	boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
