package br.com.eduardo.mealplanner.weeklyplan;

import br.com.eduardo.mealplanner.recipe.RecipeSummaryResponse;
import java.time.LocalDate;
import java.util.List;

record WeeklyPlanResponse(LocalDate weekStart, List<RecipeSummaryResponse> recipes) {
}
