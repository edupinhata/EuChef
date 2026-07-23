package br.com.eduardo.mealplanner.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RecipeApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private EntityManagerFactory entityManagerFactory;

	@Test
	void createsAndRetrievesRecipeWithQuantitiesAndOrderedPreparationSteps() throws Exception {
		long pumpkinId = createIngredient("Abóbora japonesa", "GRAM");
		long onionId = createIngredient("Cebola roxa", "UNIT");
		var request = """
				{
				  "name": "Sopa cremosa de abóbora",
				  "description": "Sopa simples para dias frios",
				  "servings": 4,
				  "preparationTimeMinutes": 45,
				  "ingredients": [
				    {
				      "ingredientId": %d,
				      "quantity": 600,
				      "unit": "GRAM",
				      "notes": "sem casca e em cubos"
				    },
				    {
				      "ingredientId": %d,
				      "quantity": 1,
				      "unit": "UNIT"
				    }
				  ],
				  "preparationSteps": [
				    "Refogue a cebola até ficar macia.",
				    "Junte a abóbora e cozinhe até amaciar.",
				    "Bata até obter um creme uniforme."
				  ]
				}
				""".formatted(pumpkinId, onionId);

		var response = mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("Sopa cremosa de abóbora"))
				.andExpect(jsonPath("$.ingredients.length()").value(2))
				.andExpect(jsonPath("$.ingredients[0].ingredientName").value("Abóbora japonesa"))
				.andExpect(jsonPath("$.ingredients[0].quantity").value(600))
				.andExpect(jsonPath("$.preparationSteps[0].position").value(1))
				.andExpect(jsonPath("$.preparationSteps[2].instruction")
						.value("Bata até obter um creme uniforme."))
				.andReturn();

		var location = response.getResponse().getHeader("Location");
		mockMvc.perform(get(location).with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.servings").value(4))
				.andExpect(jsonPath("$.preparationTimeMinutes").value(45));
	}

	@Test
	void listsUpdatesAndDeletesRecipe() throws Exception {
		long ingredientId = createIngredient("Lentilha marrom", "GRAM");
		var original = recipeRequest("Ensopado de lentilha", ingredientId, "Cozinhe a lentilha.");
		var location = mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(original))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getHeader("Location");

		mockMvc.perform(get("/api/v1/recipes").with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[?(@.name == 'Ensopado de lentilha')]").exists());

		var updated = recipeRequest("Ensopado especial de lentilha", ingredientId,
				"Deixe a lentilha de molho.", "Cozinhe até ficar macia.");
		mockMvc.perform(put(location)
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(updated))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Ensopado especial de lentilha"))
				.andExpect(jsonPath("$.preparationSteps.length()").value(2))
				.andExpect(jsonPath("$.preparationSteps[1].position").value(2));

		mockMvc.perform(delete(location).with(csrf()).with(user("test@example.com").roles("USER"))).andExpect(status().isNoContent());
		mockMvc.perform(get(location).with(user("test@example.com").roles("USER")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void listsRecipesWithStablePaginationAndConstantQueryCount() throws Exception {
		long ingredientId = createIngredient("Ingrediente para paginação de receitas", "GRAM");
		createRecipe("00 Receita paginada A", ingredientId);
		createRecipe("00 Receita paginada B", ingredientId);
		createRecipe("00 Receita paginada C", ingredientId);

		var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.clear();

		mockMvc.perform(get("/api/v1/recipes?page=0&size=2")
				.with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].name").value("00 Receita paginada A"))
				.andExpect(jsonPath("$.content[1].name").value("00 Receita paginada B"))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").isNumber())
				.andExpect(jsonPath("$.totalPages").isNumber())
				.andExpect(jsonPath("$.hasNext").value(true));

		assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
	}

	@Test
	void rejectsRecipePagesLargerThanTheConfiguredMaximum() throws Exception {
		mockMvc.perform(get("/api/v1/recipes?size=101")
				.with(user("test@example.com").roles("USER")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void reportsAllMissingIngredientsInOneValidationResult() throws Exception {
		var request = """
				{
				  "name": "Receita com ingredientes ausentes",
				  "servings": 2,
				  "preparationTimeMinutes": 10,
				  "ingredients": [
				    { "ingredientId": 999998, "quantity": 1, "unit": "UNIT" },
				    { "ingredientId": 999999, "quantity": 2, "unit": "UNIT" }
				  ],
				  "preparationSteps": ["Não deve ser persistida."]
				}
				""";

		mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("INGREDIENTS_NOT_FOUND"))
				.andExpect(jsonPath("$.details.missingIngredientIds",
						org.hamcrest.Matchers.containsInAnyOrder(999998, 999999)))
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("999998")))
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("999999")));
	}

	private String recipeRequest(String name, long ingredientId, String... steps) {
		var stepJson = java.util.Arrays.stream(steps)
				.map(step -> "\"" + step + "\"")
				.collect(java.util.stream.Collectors.joining(","));
		return """
				{
				  "name": "%s",
				  "servings": 2,
				  "preparationTimeMinutes": 30,
				  "ingredients": [{
				    "ingredientId": %d,
				    "quantity": 200,
				    "unit": "GRAM"
				  }],
				  "preparationSteps": [%s]
				}
				""".formatted(name, ingredientId, stepJson);
	}

	private void createRecipe(String name, long ingredientId) throws Exception {
		mockMvc.perform(post("/api/v1/recipes")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(recipeRequest(name, ingredientId, "Prepare a receita.")))
				.andExpect(status().isCreated());
	}

	private long createIngredient(String name, String unit) throws Exception {
		var request = """
				{
				  "name": "%s",
				  "defaultUnit": "%s"
				}
				""".formatted(name, unit);
		var location = mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getHeader("Location");
		return Long.parseLong(location.substring(location.lastIndexOf('/') + 1));
	}
}
