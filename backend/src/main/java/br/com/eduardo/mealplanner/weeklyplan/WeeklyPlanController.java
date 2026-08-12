package br.com.eduardo.mealplanner.weeklyplan;

import jakarta.validation.Valid;
import java.net.URI;
import java.security.Principal;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/weekly-plans")
class WeeklyPlanController {

	private final WeeklyPlanService service;

	WeeklyPlanController(WeeklyPlanService service) {
		this.service = service;
	}

	@GetMapping("/{weekStart}")
	WeeklyPlanResponse get(Principal principal,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
		return service.get(principal.getName(), weekStart);
	}

	@GetMapping("/{weekStart}/shopping-list")
	ShoppingListResponse getShoppingList(Principal principal,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
		return service.getShoppingList(principal.getName(), weekStart);
	}

	@PostMapping("/{weekStart}/recipes")
	ResponseEntity<WeeklyPlanResponse> addRecipe(Principal principal,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
			@Valid @RequestBody WeeklyPlanRecipeRequest request) {
		WeeklyPlanResponse response = service.addRecipe(
				principal.getName(), weekStart, request.recipeId(), request.quantityOrDefault());
		return ResponseEntity.created(URI.create("/api/v1/weekly-plans/" + weekStart)).body(response);
	}

	@PutMapping("/{weekStart}/recipes/{recipeId}")
	WeeklyPlanResponse updateQuantity(Principal principal,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
			@PathVariable Long recipeId,
			@Valid @RequestBody WeeklyPlanQuantityRequest request) {
		return service.updateQuantity(
				principal.getName(), weekStart, recipeId, request.quantityAsInt());
	}

	@DeleteMapping("/{weekStart}/recipes/{recipeId}")
	ResponseEntity<Void> removeRecipe(Principal principal,
			@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
			@PathVariable Long recipeId) {
		service.removeRecipe(principal.getName(), weekStart, recipeId);
		return ResponseEntity.noContent().build();
	}
}
