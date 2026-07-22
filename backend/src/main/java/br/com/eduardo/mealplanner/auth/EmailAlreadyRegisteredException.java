package br.com.eduardo.mealplanner.auth;

public class EmailAlreadyRegisteredException extends RuntimeException {
	public EmailAlreadyRegisteredException() {
		super("Já existe uma conta com este e-mail");
	}
}
