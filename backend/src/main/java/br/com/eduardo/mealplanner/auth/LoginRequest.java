package br.com.eduardo.mealplanner.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record LoginRequest(
		@NotBlank @Email @Size(max = 254) String email,
		@NotBlank @Size(max = 128) String password) {

	LoginRequest {
		email = email == null ? null : email.strip();
	}
}
