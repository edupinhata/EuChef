package br.com.eduardo.mealplanner.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record RegistrationRequest(
		@NotBlank @Size(max = 100) String displayName,
		@NotBlank @Email @Size(max = 254) String email,
		@NotBlank @Size(min = 12, max = 128) String password) {

	RegistrationRequest {
		displayName = displayName == null ? null : displayName.strip();
		email = email == null ? null : email.strip();
	}
}
