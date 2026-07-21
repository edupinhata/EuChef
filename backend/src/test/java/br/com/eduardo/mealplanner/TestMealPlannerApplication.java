package br.com.eduardo.mealplanner;

import org.springframework.boot.SpringApplication;

public class TestMealPlannerApplication {

	public static void main(String[] args) {
		SpringApplication.from(MealPlannerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
