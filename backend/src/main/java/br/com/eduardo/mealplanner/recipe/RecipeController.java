package br.com.eduardo.mealplanner.recipe;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/recipes")
class RecipeController {

	private final RecipeService service;

	RecipeController(RecipeService service) {
		this.service = service;
	}

	@PostMapping
	ResponseEntity<RecipeResponse> create(@Valid @RequestBody RecipeRequest request) {
		var response = service.create(request);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{id}")
				.buildAndExpand(response.id())
				.toUri();
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	List<RecipeResponse> list() {
		return service.list();
	}

	@GetMapping("/{id}")
	RecipeResponse get(@PathVariable Long id) {
		return service.get(id);
	}

	@PutMapping("/{id}")
	RecipeResponse update(@PathVariable Long id, @Valid @RequestBody RecipeRequest request) {
		return service.update(id, request);
	}

	@DeleteMapping("/{id}")
	ResponseEntity<Void> delete(@PathVariable Long id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
}
