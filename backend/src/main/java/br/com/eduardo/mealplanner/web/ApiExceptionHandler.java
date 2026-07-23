package br.com.eduardo.mealplanner.web;

import br.com.eduardo.mealplanner.auth.EmailAlreadyRegisteredException;
import br.com.eduardo.mealplanner.auth.InvalidCredentialsException;
import br.com.eduardo.mealplanner.ingredient.IngredientsNotFoundException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
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

	@ExceptionHandler(IngredientsNotFoundException.class)
	ResponseEntity<ApiError> handleIngredientsNotFound(IngredientsNotFoundException exception) {
		return error(HttpStatus.NOT_FOUND, "INGREDIENTS_NOT_FOUND", exception.getMessage(), Map.of());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> fields = new LinkedHashMap<>();
		exception.getBindingResult().getFieldErrors()
				.forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
		return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
				"Existem campos inválidos na requisição", fields);
	}

	@ExceptionHandler(ConstraintViolationException.class)
	ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
		Map<String, String> fields = new LinkedHashMap<>();
		exception.getConstraintViolations().forEach(violation ->
				fields.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage()));
		return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
				"Existem parâmetros inválidos na requisição", fields);
	}

	@ExceptionHandler({DuplicateResourceException.class, DataIntegrityViolationException.class})
	ResponseEntity<ApiError> handleDuplicate(RuntimeException exception) {
		var message = exception instanceof DuplicateResourceException
				? exception.getMessage()
				: "Já existe um recurso com os mesmos dados únicos";
		return error(HttpStatus.CONFLICT, "DUPLICATE_RESOURCE", message, Map.of());
	}

	@ExceptionHandler(EmailAlreadyRegisteredException.class)
	ResponseEntity<ApiError> handleEmailAlreadyRegistered(EmailAlreadyRegisteredException exception) {
		return error(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED", exception.getMessage(), Map.of());
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException exception) {
		return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", exception.getMessage(), Map.of());
	}

	private ResponseEntity<ApiError> error(HttpStatus status, String code, String message,
			Map<String, String> fields) {
		return ResponseEntity.status(status)
				.body(new ApiError(code, message, Instant.now(), fields));
	}
}
