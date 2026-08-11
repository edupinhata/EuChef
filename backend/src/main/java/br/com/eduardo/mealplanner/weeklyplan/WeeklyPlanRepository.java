package br.com.eduardo.mealplanner.weeklyplan;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface WeeklyPlanRepository extends JpaRepository<WeeklyPlanEntry, Long> {
	List<WeeklyPlanEntry> findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(Long userId, LocalDate weekStart);
	long deleteByUserIdAndWeekStartAndRecipeId(Long userId, LocalDate weekStart, Long recipeId);
}
