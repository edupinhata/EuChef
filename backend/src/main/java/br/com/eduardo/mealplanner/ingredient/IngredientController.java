package br.com.eduardo.mealplanner.ingredient;

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
@RequestMapping("/api/v1/ingredients")
class IngredientController {

	private final IngredientService service;

	IngredientController(IngredientService service) {
		this.service = service;
	}

	@PostMapping
	ResponseEntity<IngredientResponse> create(@Valid @RequestBody IngredientRequest request) {
		var response = service.create(request);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{id}")
				.buildAndExpand(response.id())
				.toUri();
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	List<IngredientResponse> list() {
		return service.list();
	}

	@GetMapping("/{id}")
	IngredientResponse get(@PathVariable Long id) {
		return service.get(id);
	}

	@PutMapping("/{id}")
	IngredientResponse update(@PathVariable Long id, @Valid @RequestBody IngredientRequest request) {
		return service.update(id, request);
	}

	@DeleteMapping("/{id}")
	ResponseEntity<Void> delete(@PathVariable Long id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
}
