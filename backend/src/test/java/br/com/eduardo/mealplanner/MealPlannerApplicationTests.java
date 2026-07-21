package br.com.eduardo.mealplanner;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class MealPlannerApplicationTests {

	@Test
	void contextLoads() {
	}

}
