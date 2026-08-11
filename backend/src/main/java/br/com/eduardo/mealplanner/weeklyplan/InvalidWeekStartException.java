package br.com.eduardo.mealplanner.weeklyplan;

public class InvalidWeekStartException extends RuntimeException {
	public InvalidWeekStartException() {
		super("A data inicial da semana deve ser uma segunda-feira");
	}
}
