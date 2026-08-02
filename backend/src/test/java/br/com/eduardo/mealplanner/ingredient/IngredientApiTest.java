package br.com.eduardo.mealplanner.ingredient;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class IngredientApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void createsAndRetrievesIngredientWithNutritionAndSeasonality() throws Exception {
		var request = """
				{
				  "name": "Ingrediente teste nutricional cabotiá",
				  "description": "Abóbora de polpa firme",
				  "defaultUnit": "GRAM",
				  "nutritionPer100g": {
				    "caloriesKcal": 48.0,
				    "proteinGrams": 1.4,
				    "carbohydrateGrams": 10.8,
				    "fatGrams": 0.7,
				    "fiberGrams": 2.6,
				    "sodiumMilligrams": 1.0
				  },
				  "seasonality": {
				    "startMonth": 5,
				    "endMonth": 9
				  }
				}
				""";

		var response = mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("Ingrediente teste nutricional cabotiá"))
				.andExpect(jsonPath("$.nutritionPer100g.caloriesKcal").value(48.0))
				.andExpect(jsonPath("$.seasonality.startMonth").value(5))
				.andReturn();

		var location = response.getResponse().getHeader("Location");

		mockMvc.perform(get(location).with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.description").value("Abóbora de polpa firme"))
				.andExpect(jsonPath("$.defaultUnit").value("GRAM"))
				.andExpect(jsonPath("$.nutritionPer100g.fiberGrams").value(2.6))
				.andExpect(jsonPath("$.seasonality.endMonth").value(9));
	}

	@Test
	void listsUpdatesAndDeletesIngredient() throws Exception {
		var location = createMinimalIngredient("Ingrediente teste CRUD tomate");

		mockMvc.perform(get("/api/v1/ingredients")
				.param("q", "teste CRUD tomate")
				.with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[?(@.name == 'Ingrediente teste CRUD tomate')]").exists());

		var update = """
				{
				  "name": "Tomate italiano maduro",
				  "description": "Ideal para molhos",
				  "defaultUnit": "KILOGRAM"
				}
				""";

		mockMvc.perform(put(location)
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(update))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Tomate italiano maduro"))
				.andExpect(jsonPath("$.defaultUnit").value("KILOGRAM"));

		mockMvc.perform(delete(location).with(csrf()).with(user("test@example.com").roles("USER")))
				.andExpect(status().isNoContent());

		mockMvc.perform(get(location).with(user("test@example.com").roles("USER")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void rejectsInvalidAndDuplicateIngredients() throws Exception {
		var invalid = """
				{
				  "name": " ",
				  "defaultUnit": "GRAM",
				  "nutritionPer100g": { "caloriesKcal": -1 },
				  "seasonality": { "startMonth": 0, "endMonth": 13 }
				}
				""";

		mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(invalid))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.name").exists())
				.andExpect(jsonPath("$.fieldErrors['nutritionPer100g.caloriesKcal']").exists())
				.andExpect(jsonPath("$.fieldErrors['seasonality.startMonth']").exists());

		createMinimalIngredient("Ingrediente teste duplicado manjericão");

		var duplicate = """
				{
				  "name": "  INGREDIENTE TESTE DUPLICADO MANJERICÃO  ",
				  "defaultUnit": "GRAM"
				}
				""";
		mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(duplicate))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
	}

	@Test
	void searchesIngredientsByLiteralNameFragmentWithStablePagination() throws Exception {
		createMinimalIngredient("00 Busca P1 Abacate");
		createMinimalIngredient("00 Busca P1 Abacaxi");
		createMinimalIngredient("00 Busca P1 Abóbora");
		createMinimalIngredient("Ingrediente fora da busca");
		createMinimalIngredient("Ingrediente busca frango-teste-exclusivo");
		createMinimalIngredient("% Ingrediente literal");
		createMinimalIngredient("_ Ingrediente literal");
		createMinimalIngredient("! Ingrediente literal");

		mockMvc.perform(get("/api/v1/ingredients")
				.param("q", "00 Busca P1")
				.param("page", "0")
				.param("size", "2")
				.with(user("test@example.com").roles("USER")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].name").value("00 Busca P1 Abacate"))
				.andExpect(jsonPath("$.content[1].name").value("00 Busca P1 Abacaxi"))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").value(3))
				.andExpect(jsonPath("$.totalPages").value(2))
				.andExpect(jsonPath("$.hasNext").value(true))
				.andExpect(jsonPath("$.hasPrevious").value(false));

		mockMvc.perform(get("/api/v1/ingredients")
				.with(user("test@example.com").roles("USER"))
				.param("q", "%")
				.param("page", "0")
				.param("size", "20"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(1))
				.andExpect(jsonPath("$.content[0].name").value("% Ingrediente literal"));

		assertLiteralSearch("frango-teste-exclusivo", "Ingrediente busca frango-teste-exclusivo");
		assertLiteralSearch("_", "_ Ingrediente literal");
		assertLiteralSearch("!", "! Ingrediente literal");
	}

	@Test
	void exposesStableNamesForInvalidPaginationAndSearchParameters() throws Exception {
		assertInvalidQueryParameter("size", "101");
		assertInvalidQueryParameter("page", "-1");
		assertInvalidQueryParameter("q", "x".repeat(101));
	}

	private void assertInvalidQueryParameter(String parameter, String value) throws Exception {
		mockMvc.perform(get("/api/v1/ingredients")
				.with(user("test@example.com").roles("USER"))
				.param(parameter, value))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors." + parameter).isNotEmpty());
	}

	private void assertLiteralSearch(String query, String expectedName) throws Exception {
		mockMvc.perform(get("/api/v1/ingredients")
				.with(user("test@example.com").roles("USER"))
				.param("q", query)
				.param("page", "0")
				.param("size", "20"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(1))
				.andExpect(jsonPath("$.content[0].name").value(expectedName));
	}

	private String createMinimalIngredient(String name) throws Exception {
		var request = """
				{
				  "name": "%s",
				  "defaultUnit": "UNIT"
				}
				""".formatted(name);
		return mockMvc.perform(post("/api/v1/ingredients")
				.with(csrf())
				.with(user("test@example.com").roles("USER"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getHeader("Location");
	}
}
