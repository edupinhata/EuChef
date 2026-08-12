package br.com.eduardo.mealplanner.weeklyplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import br.com.eduardo.mealplanner.auth.UserIdentityProvider;
import java.sql.Connection;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = {
		"euchef.security.rate-limit.auth-requests=100",
		"euchef.security.rate-limit.api-requests=1000"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class WeeklyPlanApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserIdentityProvider userIdentityProvider;

	@Autowired
	private PlatformTransactionManager transactionManager;

	@Autowired
	private DataSource dataSource;

	@Test
	void addsAndListsARecipeForTheAuthenticatedUsersWeek() throws Exception {
		String email = "weekly-owner@example.com";
		registerUser(email, "Dono do planejamento");
		long recipeId = createRecipe("Receita semanal persistida", email);

		mockMvc.perform(post("/api/v1/weekly-plans/2026-07-27/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{ "recipeId": %d }
						""".formatted(recipeId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.weekStart").value("2026-07-27"))
				.andExpect(jsonPath("$.recipes[0].id").value(recipeId))
				.andExpect(jsonPath("$.recipes[0].name").value("Receita semanal persistida"));

		mockMvc.perform(get("/api/v1/weekly-plans/2026-07-27")
				.with(user(email).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.weekStart").value("2026-07-27"))
				.andExpect(jsonPath("$.recipes.length()").value(1))
				.andExpect(jsonPath("$.recipes[0].preparationTimeMinutes").value(30));
	}

	@Test
	void persistsAndUpdatesHowManyTimesARecipeWillBePrepared() throws Exception {
		String email = "weekly-quantity@example.com";
		registerUser(email, "Quantidade semanal");
		long recipeId = createRecipe("Receita preparada várias vezes", email);
		String path = "/api/v1/weekly-plans/2026-07-27/recipes";

		mockMvc.perform(post(path)
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"recipeId\": %d, \"quantity\": 3 }".formatted(recipeId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.recipes[0].id").value(recipeId))
				.andExpect(jsonPath("$.recipes[0].plannedQuantity").value(3));

		mockMvc.perform(put(path + "/{recipeId}", recipeId)
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"quantity\": 5 }"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipes[0].plannedQuantity").value(5));

		mockMvc.perform(get("/api/v1/weekly-plans/2026-07-27")
				.with(user(email).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipes[0].plannedQuantity").value(5));

		for (String invalidQuantity : new String[] { "0", "101", "1.5" }) {
			mockMvc.perform(put(path + "/{recipeId}", recipeId)
					.with(csrf())
					.with(user(email).roles("USER"))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{ \"quantity\": %s }".formatted(invalidQuantity)))
					.andExpect(status().isBadRequest());
		}

		String otherEmail = "weekly-quantity-other@example.com";
		registerUser(otherEmail, "Outro planejamento");
		mockMvc.perform(put(path + "/{recipeId}", recipeId)
				.with(csrf())
				.with(user(otherEmail).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"quantity\": 2 }"))
				.andExpect(status().isNotFound());
	}

	@Test
	void consolidatesTheShoppingListAndRoundsFractionalUnitsUp() throws Exception {
		String email = "weekly-shopping@example.com";
		registerUser(email, "Lista de compras semanal");
		long eggId = createIngredient("Ovo para lista semanal", email);
		long flourId = createIngredient("Farinha para lista semanal", email);
		long omeletId = createRecipeWithIngredient(
				"Omelete semanal", email, eggId, "0.5", "UNIT");
		long cakeId = createRecipeWithIngredient(
				"Bolo semanal", email, eggId, "0.25", "UNIT");
		long breadId = createRecipeWithIngredient(
				"Pão semanal", email, flourId, "125.5", "GRAM");
		String planPath = "/api/v1/weekly-plans/2026-07-27/recipes";

		addRecipeToPlan(email, planPath, omeletId, 3);
		addRecipeToPlan(email, planPath, cakeId, 1);
		addRecipeToPlan(email, planPath, breadId, 3);

		mockMvc.perform(get("/api/v1/weekly-plans/2026-07-27/shopping-list")
				.with(user(email).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.weekStart").value("2026-07-27"))
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].ingredientId").value(flourId))
				.andExpect(jsonPath("$.items[0].quantity").value(376.5))
				.andExpect(jsonPath("$.items[0].unit").value("GRAM"))
				.andExpect(jsonPath("$.items[1].ingredientId").value(eggId))
				.andExpect(jsonPath("$.items[1].quantity").value(2))
				.andExpect(jsonPath("$.items[1].unit").value("UNIT"));

		String otherEmail = "weekly-shopping-other@example.com";
		registerUser(otherEmail, "Outra lista semanal");
		mockMvc.perform(get("/api/v1/weekly-plans/2026-07-27/shopping-list")
				.with(user(otherEmail).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isEmpty());
	}

	@Test
	void removesARecipeFromTheAuthenticatedUsersWeek() throws Exception {
		String email = "weekly-remove@example.com";
		registerUser(email, "Usuário que remove planejamento");
		long recipeId = createRecipe("Receita semanal removível", email);
		mockMvc.perform(post("/api/v1/weekly-plans/2026-08-03/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{ "recipeId": %d }
						""".formatted(recipeId)))
				.andExpect(status().isCreated());

		mockMvc.perform(delete("/api/v1/weekly-plans/2026-08-03/recipes/{recipeId}", recipeId)
				.with(csrf())
				.with(user(email).roles("USER")))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/weekly-plans/2026-08-03")
				.with(user(email).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipes").isEmpty());
	}

	@Test
	void rejectsAWeekThatDoesNotStartOnMonday() throws Exception {
		String email = "weekly-invalid-week@example.com";
		registerUser(email, "Usuário com semana inválida");

		mockMvc.perform(get("/api/v1/weekly-plans/2026-07-28")
				.with(user(email).roles("USER")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_WEEK_START"));
	}

	@Test
	void rejectsMalformedWeekStartsWithTheStableApiError() throws Exception {
		String email = "weekly-malformed-week@example.com";
		registerUser(email, "Usuário com formato de semana inválido");

		mockMvc.perform(get("/api/v1/weekly-plans/not-a-date")
				.with(user(email).roles("USER")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_WEEK_START"));

		mockMvc.perform(post("/api/v1/weekly-plans/2026-99-99/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"recipeId\": 1 }"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_WEEK_START"));

		mockMvc.perform(delete("/api/v1/weekly-plans/invalid/recipes/1")
				.with(csrf())
				.with(user(email).roles("USER")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_WEEK_START"));
	}

	@Test
	void rejectsAnUnknownRecipe() throws Exception {
		String email = "weekly-unknown-recipe@example.com";
		registerUser(email, "Usuário com receita ausente");

		mockMvc.perform(post("/api/v1/weekly-plans/2026-08-10/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"recipeId\": 999999 }"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void rejectsTheSameRecipeTwiceInAWeek() throws Exception {
		String email = "weekly-duplicate@example.com";
		registerUser(email, "Usuário com receita duplicada");
		long recipeId = createRecipe("Receita semanal sem duplicação", email);
		String path = "/api/v1/weekly-plans/2026-08-17/recipes";
		String body = "{ \"recipeId\": %d }".formatted(recipeId);

		mockMvc.perform(post(path)
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isCreated());

		mockMvc.perform(post(path)
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
	}

	@Test
	void isolatesWeeklyPlansBetweenAuthenticatedUsers() throws Exception {
		String ownerEmail = "weekly-isolation-owner@example.com";
		String otherEmail = "weekly-isolation-other@example.com";
		registerUser(ownerEmail, "Dono isolado");
		registerUser(otherEmail, "Outro usuário");
		long recipeId = createRecipe("Receita de planejamento isolado", ownerEmail);
		String weekStart = "2026-08-24";

		mockMvc.perform(post("/api/v1/weekly-plans/{weekStart}/recipes", weekStart)
				.with(csrf())
				.with(user(ownerEmail).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"recipeId\": %d }".formatted(recipeId)))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/weekly-plans/{weekStart}", weekStart)
				.with(user(otherEmail).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipes").isEmpty());

		mockMvc.perform(delete("/api/v1/weekly-plans/{weekStart}/recipes/{recipeId}", weekStart, recipeId)
				.with(csrf())
				.with(user(otherEmail).roles("USER")))
				.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/v1/weekly-plans/{weekStart}", weekStart)
				.with(user(ownerEmail).roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipes[0].id").value(recipeId));
	}

	@Test
	void serializesConcurrentWeeklyPlanMutationsWithADatabaseLock() throws Exception {
		String email = "weekly-concurrent-lock@example.com";
		jdbcTemplate.update("""
				INSERT INTO app_users (display_name, email, password_hash, role)
				VALUES (?, ?, ?, 'USER')
				""", "Lock concorrente", email, "unused-password-hash");

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch firstLockAcquired = new CountDownLatch(1);
		CountDownLatch releaseFirstLock = new CountDownLatch(1);
		CountDownLatch secondLockAcquired = new CountDownLatch(1);
		CompletableFuture<Integer> secondBackendPid = new CompletableFuture<>();
		try {
			Future<Void> first = executor.submit(() -> {
				new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
					userIdentityProvider.requireUserIdForUpdate(email);
					firstLockAcquired.countDown();
					await(releaseFirstLock);
				});
				return null;
			});
			assertThat(firstLockAcquired.await(5, TimeUnit.SECONDS)).isTrue();

			Future<Void> second = executor.submit(() -> {
				new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
					secondBackendPid.complete(jdbcTemplate.queryForObject(
							"SELECT pg_backend_pid()", Integer.class));
					userIdentityProvider.requireUserIdForUpdate(email);
					secondLockAcquired.countDown();
				});
				return null;
			});

			Integer backendPid = secondBackendPid.get(5, TimeUnit.SECONDS);
			assertThat(waitUntilWaitingForDatabaseLock(backendPid)).isTrue();
			assertThat(secondLockAcquired.getCount()).isEqualTo(1);
			releaseFirstLock.countDown();
			first.get(10, TimeUnit.SECONDS);
			second.get(10, TimeUnit.SECONDS);
			assertThat(secondLockAcquired.getCount()).isZero();
		} finally {
			releaseFirstLock.countDown();
			executor.shutdownNow();
		}
	}

	@Test
	void serializesRecipeDeletionAgainstWeeklyPlanAddition() throws Exception {
		String email = "weekly-concurrent-recipe-delete@example.com";
		registerUser(email, "Exclusão concorrente de receita");
		long recipeId = createRecipe("Receita protegida contra exclusão concorrente", email);
		long advisoryLockKey = 830_427_119L;
		installBlockingWeeklyPlanInsertTrigger(advisoryLockKey);

		ExecutorService executor = Executors.newFixedThreadPool(2);
		try (Connection lockConnection = dataSource.getConnection();
				Statement lockStatement = lockConnection.createStatement()) {
			lockConnection.setAutoCommit(false);
			lockStatement.execute("SELECT pg_advisory_xact_lock(" + advisoryLockKey + ")");

			Future<MvcResult> addition = executor.submit(() -> mockMvc.perform(
					post("/api/v1/weekly-plans/2026-09-07/recipes")
							.with(csrf())
							.with(user(email).roles("USER"))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{ \"recipeId\": %d }".formatted(recipeId)))
					.andReturn());
			assertThat(waitUntilWeeklyPlanInsertIsBlocked()).isTrue();

			Future<MvcResult> deletion = executor.submit(() -> mockMvc.perform(
					delete("/api/v1/recipes/{recipeId}", recipeId)
							.with(csrf())
							.with(user(email).roles("USER")))
					.andReturn());

			assertThatThrownBy(() -> deletion.get(2, TimeUnit.SECONDS))
					.isInstanceOf(TimeoutException.class);
			lockConnection.commit();

			assertThat(addition.get(10, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(201);
			assertThat(deletion.get(10, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(204);
		} finally {
			executor.shutdownNow();
			jdbcTemplate.execute("DROP TRIGGER IF EXISTS weekly_plan_insert_blocker ON weekly_plan_entries");
			jdbcTemplate.execute("DROP FUNCTION IF EXISTS block_weekly_plan_insert()");
		}
	}

	private void installBlockingWeeklyPlanInsertTrigger(long advisoryLockKey) {
		jdbcTemplate.execute("""
				CREATE OR REPLACE FUNCTION block_weekly_plan_insert()
				RETURNS trigger AS $$
				BEGIN
				  PERFORM pg_advisory_xact_lock(%d);
				  RETURN NEW;
				END;
				$$ LANGUAGE plpgsql
				""".formatted(advisoryLockKey));
		jdbcTemplate.execute("""
				CREATE TRIGGER weekly_plan_insert_blocker
				BEFORE INSERT ON weekly_plan_entries
				FOR EACH ROW EXECUTE FUNCTION block_weekly_plan_insert()
				""");
	}

	private boolean waitUntilWeeklyPlanInsertIsBlocked() throws InterruptedException {
		for (int attempt = 0; attempt < 200; attempt++) {
			Integer blockedInserts = jdbcTemplate.queryForObject("""
					SELECT COUNT(*)
					FROM pg_stat_activity
					WHERE wait_event_type = 'Lock'
					  AND query LIKE 'insert into weekly_plan_entries%'
					""", Integer.class);
			if (blockedInserts != null && blockedInserts > 0) {
				return true;
			}
			Thread.sleep(50);
		}
		return false;
	}

	private boolean waitUntilWaitingForDatabaseLock(Integer backendPid) throws InterruptedException {
		for (int attempt = 0; attempt < 200; attempt++) {
			String waitEventType = jdbcTemplate.queryForObject(
					"SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?",
					String.class, backendPid);
			if ("Lock".equals(waitEventType)) {
				return true;
			}
			Thread.sleep(50);
		}
		return false;
	}

	private void await(CountDownLatch latch) {
		try {
			latch.await();
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Interrupted while coordinating the lock test", exception);
		}
	}

	private void registerUser(String email, String displayName) throws Exception {
		mockMvc.perform(post("/api/v1/auth/register")
				.with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "displayName": "%s",
						  "email": "%s",
						  "password": "WeeklyPlan#12345"
						}
						""".formatted(displayName, email)))
				.andExpect(status().isCreated());
	}

	private long createRecipe(String name, String email) throws Exception {
		long ingredientId = createIngredient("Ingrediente de " + name, email);
		MvcResult result = mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "name": "%s",
						  "servings": 2,
						  "preparationTimeMinutes": 30,
						  "ingredients": [{
						    "ingredientId": %d,
						    "quantity": 1,
						    "unit": "UNIT"
						  }],
						  "preparationSteps": ["Prepare a receita."]
						}
						""".formatted(name, ingredientId)))
				.andExpect(status().isCreated())
				.andReturn();
		return idFromLocation(result);
	}

	private long createRecipeWithIngredient(String name, String email, long ingredientId,
			String quantity, String unit) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "name": "%s",
						  "servings": 2,
						  "preparationTimeMinutes": 30,
						  "ingredients": [{
						    "ingredientId": %d,
						    "quantity": %s,
						    "unit": "%s"
						  }],
						  "preparationSteps": ["Prepare a receita."]
						}
						""".formatted(name, ingredientId, quantity, unit)))
				.andExpect(status().isCreated())
				.andReturn();
		return idFromLocation(result);
	}

	private void addRecipeToPlan(String email, String planPath, long recipeId, int quantity)
			throws Exception {
		mockMvc.perform(post(planPath)
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{ \"recipeId\": %d, \"quantity\": %d }".formatted(recipeId, quantity)))
				.andExpect(status().isCreated());
	}

	private long createIngredient(String name, String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user(email).roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{ "name": "%s", "defaultUnit": "UNIT" }
						""".formatted(name)))
				.andExpect(status().isCreated())
				.andReturn();
		return idFromLocation(result);
	}

	private long idFromLocation(MvcResult result) {
		String location = result.getResponse().getHeader("Location");
		return Long.parseLong(location.substring(location.lastIndexOf('/') + 1));
	}
}
