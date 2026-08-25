package br.com.eduardo.mealplanner.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.eduardo.mealplanner.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class InitialCatalogMigrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void initializesACompleteCatalogInAnEmptyDatabase() {
		Long ingredientCount = count("SELECT COUNT(*) FROM ingredients");
		Long recipeCount = count("SELECT COUNT(*) FROM recipes");
		Long legacyRecipesWithDisabledCatalogAuthor = count("""
				SELECT COUNT(*)
				FROM recipes recipe
				JOIN app_users author ON author.id = recipe.author_id
				WHERE author.display_name = 'Catálogo EuChef'
				  AND author.email = 'catalogo@euchef.local'
				  AND author.enabled = FALSE
				""");
		Long describedAndNourishedIngredients = count("""
				SELECT COUNT(*)
				FROM ingredients
				WHERE description IS NOT NULL
				  AND BTRIM(description) <> ''
				  AND calories_kcal IS NOT NULL
				  AND protein_grams IS NOT NULL
				  AND carbohydrate_grams IS NOT NULL
				  AND fat_grams IS NOT NULL
				  AND fiber_grams IS NOT NULL
				  AND sodium_milligrams IS NOT NULL
				""");
		Long ingredientsUsedByRecipes = count("SELECT COUNT(DISTINCT ingredient_id) FROM recipe_ingredients");
		Long distinctNutritionProfiles = count("""
				SELECT COUNT(*)
				FROM (
				    SELECT DISTINCT calories_kcal, protein_grams, carbohydrate_grams,
				                    fat_grams, fiber_grams, sodium_milligrams
				    FROM ingredients
				) nutrition_profiles
				""");
		Long plausibleNutritionSentinels = count("""
				SELECT COUNT(*)
				FROM ingredients
				WHERE (name = 'Água'
				       AND calories_kcal = 0 AND protein_grams = 0 AND carbohydrate_grams = 0
				       AND fat_grams = 0 AND fiber_grams = 0 AND sodium_milligrams = 0)
				   OR (name = 'Sal marinho' AND calories_kcal = 0 AND sodium_milligrams >= 30000)
				   OR (name = 'Mel' AND calories_kcal >= 250 AND carbohydrate_grams >= 60)
				   OR (name = 'Peito de frango' AND protein_grams >= 15 AND carbohydrate_grams <= 1)
				""");
		Long recipeIngredientCount = count("SELECT COUNT(*) FROM recipe_ingredients");
		Long validRecipeIngredients = count("""
				SELECT COUNT(*)
				FROM recipe_ingredients
				WHERE quantity > 0
				  AND unit IN ('GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'UNIT',
				               'TABLESPOON', 'TEASPOON', 'CUP', 'PINCH')
				""");
		Long recipesWithContiguousIngredientPositions = count("""
				SELECT COUNT(*)
				FROM (
				    SELECT recipe_id
				    FROM recipe_ingredients
				    GROUP BY recipe_id
				    HAVING MIN(position) = 1 AND MAX(position) = COUNT(*)
				) recipes_with_contiguous_ingredients
				""");
		Long stepCount = count("SELECT COUNT(*) FROM recipe_steps");
		Long recipesWithExactlyThreeContiguousSteps = count("""
				SELECT COUNT(*)
				FROM (
				    SELECT recipe_id
				    FROM recipe_steps
				    GROUP BY recipe_id
				    HAVING COUNT(*) = 3
				       AND COUNT(*) FILTER (WHERE BTRIM(instruction) <> '') = 3
				       AND MIN(position) = 1
				       AND MAX(position) = 3
				) recipes_with_valid_steps
				""");
		Long plausibleQuantitySentinels = count("""
				SELECT COUNT(*)
				FROM recipe_ingredients ri
				JOIN recipes r ON r.id = ri.recipe_id
				JOIN ingredients i ON i.id = ri.ingredient_id
				WHERE (r.name = 'Omelete de presunto e queijo' AND i.name = 'Ovo de galinha'
				       AND ri.quantity >= 4 AND ri.unit = 'UNIT')
				   OR (r.name = 'Omelete de presunto e queijo' AND i.name = 'Presunto cozido'
				       AND ri.quantity BETWEEN 100 AND 200 AND ri.unit = 'GRAM')
				   OR (r.name = 'Omelete de presunto e queijo' AND i.name = 'Queijo cheddar'
				       AND ri.quantity BETWEEN 80 AND 200 AND ri.unit = 'GRAM')
				   OR (r.name = 'Omelete de presunto e queijo' AND i.name = 'Óleo de canola'
				       AND ri.quantity <= 2 AND ri.unit = 'TABLESPOON')
				   OR (r.name = 'Mingau de aveia com pera' AND i.name = 'Leite integral'
				       AND ri.quantity BETWEEN 500 AND 1000 AND ri.unit = 'MILLILITER')
				   OR (r.name = 'Mingau de aveia com pera' AND i.name = 'Aveia em flocos'
				       AND ri.quantity BETWEEN 120 AND 250 AND ri.unit = 'GRAM')
				   OR (r.name = 'Mingau de aveia com pera' AND i.name = 'Noz'
				       AND ri.quantity <= 100 AND ri.unit = 'GRAM')
				   OR (r.name = 'Moqueca de peixe e camarão' AND i.name IN ('Óleo de coco', 'Azeite de dendê')
				       AND ri.quantity BETWEEN 1 AND 3 AND ri.unit = 'TABLESPOON')
				   OR (r.name = 'Cheesecake de maracujá' AND i.name = 'Gelatina incolor'
				       AND ri.quantity BETWEEN 10 AND 30 AND ri.unit = 'GRAM')
				   OR (r.name = 'Pasta de feijão-branco' AND i.name IN ('Vinagre de maçã', 'Óleo de abacate')
				       AND ri.quantity BETWEEN 1 AND 4 AND ri.unit = 'TABLESPOON')
				   OR (r.name = 'Paella de frutos do mar' AND i.name = 'Caldo de frutos do mar'
				       AND ri.quantity BETWEEN 1.4 AND 2 AND ri.unit = 'LITER')
				""");
		Long coherentPaellaPreparation = count("""
				SELECT COUNT(*)
				FROM recipe_steps step
				JOIN recipes recipe ON recipe.id = step.recipe_id
				WHERE recipe.name = 'Paella de frutos do mar'
				  AND step.position = 2
				  AND step.instruction ILIKE '%caldo%'
				  AND step.instruction NOT ILIKE '%alcachofra%'
				""");

		assertThat(ingredientCount).isEqualTo(200L);
		assertThat(recipeCount).isEqualTo(30L);
		assertThat(legacyRecipesWithDisabledCatalogAuthor).isEqualTo(recipeCount);
		assertThat(describedAndNourishedIngredients).isEqualTo(200L);
		assertThat(ingredientsUsedByRecipes).isEqualTo(200L);
		assertThat(distinctNutritionProfiles).isGreaterThanOrEqualTo(100L);
		assertThat(plausibleNutritionSentinels).isEqualTo(4L);
		assertThat(recipeIngredientCount).isEqualTo(200L);
		assertThat(validRecipeIngredients).isEqualTo(200L);
		assertThat(recipesWithContiguousIngredientPositions).isEqualTo(30L);
		assertThat(stepCount).isEqualTo(90L);
		assertThat(recipesWithExactlyThreeContiguousSteps).isEqualTo(30L);
		assertThat(plausibleQuantitySentinels).isEqualTo(13L);
		assertThat(coherentPaellaPreparation).isEqualTo(1L);
	}

	private Long count(String sql) {
		return jdbcTemplate.queryForObject(sql, Long.class);
	}
}
