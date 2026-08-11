package br.com.eduardo.mealplanner.weeklyplan;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

record WeeklyPlanRecipeRequest(@NotNull @Positive Long recipeId) {
}
