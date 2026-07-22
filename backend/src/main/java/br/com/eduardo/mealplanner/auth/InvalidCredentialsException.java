package br.com.eduardo.mealplanner.auth;

public class InvalidCredentialsException extends RuntimeException {
	public InvalidCredentialsException() {
		super("E-mail ou senha inválidos");
	}
}
