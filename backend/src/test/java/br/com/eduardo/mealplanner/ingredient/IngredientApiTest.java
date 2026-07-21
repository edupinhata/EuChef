package br.com.eduardo.mealplanner.ingredient;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
				  "name": "Abóbora cabotiá",
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
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("Abóbora cabotiá"))
				.andExpect(jsonPath("$.nutritionPer100g.caloriesKcal").value(48.0))
				.andExpect(jsonPath("$.seasonality.startMonth").value(5))
				.andReturn();

		var location = response.getResponse().getHeader("Location");

		mockMvc.perform(get(location))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.description").value("Abóbora de polpa firme"))
				.andExpect(jsonPath("$.defaultUnit").value("GRAM"))
				.andExpect(jsonPath("$.nutritionPer100g.fiberGrams").value(2.6))
				.andExpect(jsonPath("$.seasonality.endMonth").value(9));
	}

	@Test
	void listsUpdatesAndDeletesIngredient() throws Exception {
		var location = createMinimalIngredient("Tomate italiano");

		mockMvc.perform(get("/api/v1/ingredients"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.name == 'Tomate italiano')]").exists());

		var update = """
				{
				  "name": "Tomate italiano maduro",
				  "description": "Ideal para molhos",
				  "defaultUnit": "KILOGRAM"
				}
				""";

		mockMvc.perform(put(location)
				.contentType(MediaType.APPLICATION_JSON)
				.content(update))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Tomate italiano maduro"))
				.andExpect(jsonPath("$.defaultUnit").value("KILOGRAM"));

		mockMvc.perform(delete(location))
				.andExpect(status().isNoContent());

		mockMvc.perform(get(location))
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
				.contentType(MediaType.APPLICATION_JSON)
				.content(invalid))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.name").exists())
				.andExpect(jsonPath("$.fieldErrors['nutritionPer100g.caloriesKcal']").exists())
				.andExpect(jsonPath("$.fieldErrors['seasonality.startMonth']").exists());

		createMinimalIngredient("Manjericão");

		var duplicate = """
				{
				  "name": "  MANJERICÃO  ",
				  "defaultUnit": "GRAM"
				}
				""";
		mockMvc.perform(post("/api/v1/ingredients")
				.contentType(MediaType.APPLICATION_JSON)
				.content(duplicate))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
	}

	private String createMinimalIngredient(String name) throws Exception {
		var request = """
				{
				  "name": "%s",
				  "defaultUnit": "UNIT"
				}
				""".formatted(name);
		return mockMvc.perform(post("/api/v1/ingredients")
				.contentType(MediaType.APPLICATION_JSON)
				.content(request))
				.andExpect(status().isCreated())
				.andReturn()
				.getResponse()
				.getHeader("Location");
	}
}
