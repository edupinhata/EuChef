package br.com.eduardo.mealplanner.weeklyplan;

import java.time.LocalDate;
import java.util.List;

record WeeklyPlanResponse(LocalDate weekStart, List<WeeklyPlanRecipeResponse> recipes) {
}
