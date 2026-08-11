package br.com.eduardo.mealplanner.recipe;

import java.util.Collection;
import java.util.Map;

public interface RecipeCatalog {
	Map<Long, RecipeSummaryResponse> requireSummaries(Collection<Long> ids);
	Map<Long, RecipeSummaryResponse> requireSummariesForUpdate(Collection<Long> ids);
}
