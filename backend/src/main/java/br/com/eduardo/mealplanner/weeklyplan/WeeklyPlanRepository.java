package br.com.eduardo.mealplanner.weeklyplan;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface WeeklyPlanRepository extends JpaRepository<WeeklyPlanEntry, Long> {
	List<WeeklyPlanEntry> findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(Long userId, LocalDate weekStart);
	long deleteByUserIdAndWeekStartAndRecipeId(Long userId, LocalDate weekStart, Long recipeId);

	@Query(value = """
			SELECT i.id AS ingredientId,
			       i.name AS ingredientName,
			       CASE WHEN ri.unit = 'UNIT'
			            THEN CEIL(SUM(ri.quantity * wpe.planned_quantity))
			            ELSE SUM(ri.quantity * wpe.planned_quantity)
			       END AS quantity,
			       ri.unit AS unit
			FROM weekly_plan_entries wpe
			JOIN recipe_ingredients ri ON ri.recipe_id = wpe.recipe_id
			JOIN ingredients i ON i.id = ri.ingredient_id
			WHERE wpe.user_id = :userId
			  AND wpe.week_start = :weekStart
			GROUP BY i.id, i.name, ri.unit
			ORDER BY LOWER(i.name), i.id, ri.unit
			""", nativeQuery = true)
	List<ShoppingListRow> findShoppingList(
			@Param("userId") Long userId,
			@Param("weekStart") LocalDate weekStart);

	interface ShoppingListRow {
		Long getIngredientId();
		String getIngredientName();
		BigDecimal getQuantity();
		String getUnit();
	}
}
