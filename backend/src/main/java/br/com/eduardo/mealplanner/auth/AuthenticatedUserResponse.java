package br.com.eduardo.mealplanner.auth;

public record AuthenticatedUserResponse(
		Long id,
		String displayName,
		String email,
		AppRole role) {

	static AuthenticatedUserResponse from(AppUser user) {
		return new AuthenticatedUserResponse(user.id(), user.displayName(), user.email(), user.role());
	}
}
