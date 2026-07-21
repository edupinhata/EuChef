package br.com.eduardo.mealplanner.web;

import jakarta.persistence.EntityNotFoundException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class ApiExceptionHandler {

	@ExceptionHandler(EntityNotFoundException.class)
	ResponseEntity<ApiError> handleNotFound(EntityNotFoundException exception) {
		return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", exception.getMessage(), Map.of());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> fields = new LinkedHashMap<>();
		exception.getBindingResult().getFieldErrors()
				.forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
		return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
				"Existem campos inválidos na requisição", fields);
	}

	@ExceptionHandler({DuplicateResourceException.class, DataIntegrityViolationException.class})
	ResponseEntity<ApiError> handleDuplicate(RuntimeException exception) {
		var message = exception instanceof DuplicateResourceException
				? exception.getMessage()
				: "Já existe um recurso com os mesmos dados únicos";
		return error(HttpStatus.CONFLICT, "DUPLICATE_RESOURCE", message, Map.of());
	}

	private ResponseEntity<ApiError> error(HttpStatus status, String code, String message,
			Map<String, String> fields) {
		return ResponseEntity.status(status)
				.body(new ApiError(code, message, Instant.now(), fields));
	}
}
