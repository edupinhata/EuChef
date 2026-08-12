package br.com.eduardo.mealplanner.auth;

public interface UserIdentityProvider {
	Long requireUserId(String email);
	Long requireUserIdForUpdate(String email);
}
