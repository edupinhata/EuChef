package br.com.eduardo.mealplanner.ingredient;

import br.com.eduardo.mealplanner.web.PagedResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/ingredients")
@Validated
class IngredientController {

	private final IngredientService service;

	IngredientController(IngredientService service) {
		this.service = service;
	}

	@PostMapping
	ResponseEntity<IngredientResponse> create(@Valid @RequestBody IngredientRequest request) {
		IngredientResponse response = service.create(request);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest()
				.path("/{id}")
				.buildAndExpand(response.id())
				.toUri();
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	PagedResponse<IngredientResponse> list(
			@RequestParam(required = false) @Size(max = 100) String q,
			@RequestParam(defaultValue = "0") @PositiveOrZero int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
		return service.list(q, page, size);
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
