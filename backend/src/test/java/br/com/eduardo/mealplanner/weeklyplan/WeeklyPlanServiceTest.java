package br.com.eduardo.mealplanner.weeklyplan;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import br.com.eduardo.mealplanner.auth.UserIdentityProvider;
import br.com.eduardo.mealplanner.recipe.RecipeCatalog;
import br.com.eduardo.mealplanner.web.DuplicateResourceException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WeeklyPlanServiceTest {

	@Mock
	private WeeklyPlanRepository repository;

	@Mock
	private UserIdentityProvider userIdentityProvider;

	@Mock
	private RecipeCatalog recipeCatalog;

	@Test
	void locksTheUserBeforeChangingAWeeklyPlan() {
		LocalDate weekStart = LocalDate.of(2026, 8, 3);
		Long userId = 42L;
		Long recipeId = 101L;
		when(userIdentityProvider.requireUserIdForUpdate("locked@example.com")).thenAnswer(invocation -> {
			verifyNoInteractions(repository);
			return userId;
		});
		when(repository.findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(userId, weekStart))
				.thenReturn(List.of());
		when(recipeCatalog.requireSummariesForUpdate(List.of(recipeId))).thenReturn(Map.of());
		when(recipeCatalog.requireSummaries(List.of())).thenReturn(Map.of());
		WeeklyPlanService service = new WeeklyPlanService(repository, userIdentityProvider, recipeCatalog);

		service.addRecipe("locked@example.com", weekStart, recipeId);

		InOrder lockBeforeRead = inOrder(userIdentityProvider, repository);
		lockBeforeRead.verify(userIdentityProvider).requireUserIdForUpdate("locked@example.com");
		lockBeforeRead.verify(repository)
				.findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(userId, weekStart);
	}

	@Test
	void rejectsMoreThanOneHundredRecipesInAWeek() {
		LocalDate weekStart = LocalDate.of(2026, 8, 3);
		Long userId = 42L;
		List<WeeklyPlanEntry> fullPlan = LongStream.rangeClosed(1, 100)
				.mapToObj(recipeId -> new WeeklyPlanEntry(userId, weekStart, recipeId))
				.toList();
		when(userIdentityProvider.requireUserIdForUpdate("limited@example.com")).thenReturn(userId);
		when(repository.findByUserIdAndWeekStartOrderByCreatedAtAscIdAsc(userId, weekStart))
				.thenReturn(fullPlan);
		WeeklyPlanService service = new WeeklyPlanService(repository, userIdentityProvider, recipeCatalog);

		assertThatThrownBy(() -> service.addRecipe("limited@example.com", weekStart, 101L))
				.isInstanceOf(DuplicateResourceException.class)
				.hasMessage("O planejamento semanal aceita no máximo 100 receitas");
	}
}
