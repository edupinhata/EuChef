package br.com.eduardo.mealplanner.recipe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

class RecipeAuthorMigrationTest {

	@Test
	void upgradesAnExistingV9CatalogAndBackfillsEveryRecipeAuthor() throws SQLException {
		try (PostgreSQLContainer postgres = postgres()) {
			postgres.start();
			migrate(postgres, "9");

			assertThat(count(postgres, "SELECT COUNT(*) FROM recipes")).isEqualTo(30L);
			assertThat(columnExists(postgres, "recipes", "author_id")).isFalse();

			migrate(postgres, null);

			assertThat(count(postgres, """
					SELECT COUNT(*)
					FROM recipes recipe
					JOIN app_users author ON author.id = recipe.author_id
					WHERE author.display_name = 'Catálogo EuChef'
					  AND author.email = 'catalogo@euchef.local'
					  AND author.enabled = FALSE
					""")).isEqualTo(30L);
			assertThat(isNullable(postgres, "recipes", "author_id")).isFalse();
			assertThat(constraintExists(postgres, "fk_recipes_author")).isTrue();
			assertThat(indexExists(postgres, "ix_recipes_author_id")).isTrue();
			assertThat(currentVersion(postgres)).isEqualTo("10");
		}
	}

	@Test
	void failsClosedAndRollsBackWhenTheTechnicalEmailAlreadyExists() throws SQLException {
		try (PostgreSQLContainer postgres = postgres()) {
			postgres.start();
			migrate(postgres, "9");
			execute(postgres, """
					INSERT INTO app_users (display_name, email, password_hash, role, enabled)
					VALUES ('Conta preexistente', 'catalogo@euchef.local', 'not-a-login-secret', 'USER', TRUE)
					""");

			assertThatThrownBy(() -> migrate(postgres, null))
					.isInstanceOf(RuntimeException.class)
					.hasMessageContaining("V10__add_recipe_author.sql")
					.hasMessageContaining("uq_app_users_email");

			assertThat(currentVersion(postgres)).isEqualTo("9");
			assertThat(columnExists(postgres, "recipes", "author_id")).isFalse();
			assertThat(count(postgres, """
					SELECT COUNT(*) FROM app_users
					WHERE email = 'catalogo@euchef.local'
					  AND display_name = 'Conta preexistente'
					  AND enabled = TRUE
					""")).isEqualTo(1L);
		}
	}

	private PostgreSQLContainer postgres() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
				.withInitScript("db/bootstrap/postgres_extensions.sql");
	}

	private void migrate(PostgreSQLContainer postgres, String target) {
		var configuration = Flyway.configure()
				.dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
		if (target != null) {
			configuration.target(target);
		}
		configuration.load().migrate();
	}

	private long count(PostgreSQLContainer postgres, String sql) throws SQLException {
		try (Connection connection = connection(postgres);
				Statement statement = connection.createStatement();
				ResultSet result = statement.executeQuery(sql)) {
			result.next();
			return result.getLong(1);
		}
	}

	private boolean columnExists(PostgreSQLContainer postgres, String table, String column) throws SQLException {
		return count(postgres, """
				SELECT COUNT(*) FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = '%s' AND column_name = '%s'
				""".formatted(table, column)) == 1;
	}

	private boolean isNullable(PostgreSQLContainer postgres, String table, String column) throws SQLException {
		return count(postgres, """
				SELECT COUNT(*) FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = '%s' AND column_name = '%s'
				  AND is_nullable = 'YES'
				""".formatted(table, column)) == 1;
	}

	private boolean constraintExists(PostgreSQLContainer postgres, String name) throws SQLException {
		return count(postgres, """
				SELECT COUNT(*) FROM information_schema.table_constraints
				WHERE constraint_schema = 'public' AND constraint_name = '%s'
				""".formatted(name)) == 1;
	}

	private boolean indexExists(PostgreSQLContainer postgres, String name) throws SQLException {
		return count(postgres, "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = '%s'"
				.formatted(name)) == 1;
	}

	private String currentVersion(PostgreSQLContainer postgres) throws SQLException {
		try (Connection connection = connection(postgres);
				Statement statement = connection.createStatement();
				ResultSet result = statement.executeQuery("""
						SELECT version FROM flyway_schema_history
						WHERE success = TRUE ORDER BY installed_rank DESC LIMIT 1
						""")) {
			result.next();
			return result.getString(1);
		}
	}

	private void execute(PostgreSQLContainer postgres, String sql) throws SQLException {
		try (Connection connection = connection(postgres); Statement statement = connection.createStatement()) {
			statement.execute(sql);
		}
	}

	private Connection connection(PostgreSQLContainer postgres) throws SQLException {
		return java.sql.DriverManager.getConnection(
				postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
	}
}
