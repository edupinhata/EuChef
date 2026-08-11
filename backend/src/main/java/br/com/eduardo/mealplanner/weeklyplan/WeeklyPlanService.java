package br.com.eduardo.mealplanner.weeklyplan;

import br.com.eduardo.mealplanner.auth.UserIdentityProvider;
import br.com.eduardo.mealplanner.recipe.RecipeCatalog;
import br.com.eduardo.mealplanner.recipe.RecipeSummaryResponse;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import jakarta.persistence.EntityNotFoundException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class WeeklyPlanService {

	private final WeeklyPlanRepository repository;
	private final UserIdentityProvider userIdentityProvider;
	private final RecipeCatalog recipeCatalog;

	WeeklyPlanService(WeeklyPlanRepository repository, UserIdentityProvider userIdentityProvider,
			RecipeCatalog recipeCatalog) {
		this.repository = repository;
		this.userIdentityProvider = userIdentityProvider;
		this.recipeCatalog = recipeCatalog;
	}

	@Transactional(readOnly = true)
	WeeklyPlanResponse get(String email, LocalDate weekStart) {
		validateWeekStart(weekStart);
		Long userId = userIdentityProvider.requireUserId(email);
		return toResponse(userId, weekStart);
	}

	@Transactional
	WeeklyPlanResponse addRecipe(String email, LocalDate weekStart, Long recipeId) {
		validateWeekStart(weekStart);
		Long userId = userIdentityProvider.requireUserIdForUpdate(email);
		List<WeeklyPlanEntry> currentEntries = repository
				.findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(userId, weekStart);
		if (currentEntries.stream().anyMatch(entry -> Objects.equals(entry.recipeId(), recipeId))) {
			throw new DuplicateResourceException("A receita já está planejada para esta semana");
		}
		if (currentEntries.size() >= 100) {
			throw new DuplicateResourceException("O planejamento semanal aceita no máximo 100 receitas");
		}
		recipeCatalog.requireSummariesForUpdate(List.of(recipeId));
		repository.saveAndFlush(new WeeklyPlanEntry(userId, weekStart, recipeId));
		return toResponse(userId, weekStart);
	}

	@Transactional
	void removeRecipe(String email, LocalDate weekStart, Long recipeId) {
		validateWeekStart(weekStart);
		Long userId = userIdentityProvider.requireUserId(email);
		long deleted = repository.deleteByUserIdAndWeekStartAndRecipeId(userId, weekStart, recipeId);
		if (deleted == 0) {
			throw new EntityNotFoundException("Receita não encontrada no planejamento desta semana");
		}
	}

	private WeeklyPlanResponse toResponse(Long userId, LocalDate weekStart) {
		List<WeeklyPlanEntry> entries = repository
				.findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(userId, weekStart);
		Map<Long, RecipeSummaryResponse> recipes = recipeCatalog.requireSummaries(entries.stream()
				.map(WeeklyPlanEntry::recipeId)
				.toList());
		List<RecipeSummaryResponse> orderedRecipes = entries.stream()
				.map(entry -> recipes.get(entry.recipeId()))
				.toList();
		return new WeeklyPlanResponse(weekStart, orderedRecipes);
	}

	private void validateWeekStart(LocalDate weekStart) {
		if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
			throw new InvalidWeekStartException();
		}
	}
}
