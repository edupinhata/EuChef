package br.com.eduardo.mealplanner.ingredient;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
class Seasonality {

	@Column(name = "season_start_month")
	private Integer startMonth;

	@Column(name = "season_end_month")
	private Integer endMonth;

	protected Seasonality() {
	}

	Seasonality(Integer startMonth, Integer endMonth) {
		this.startMonth = startMonth;
		this.endMonth = endMonth;
	}

	Integer startMonth() { return startMonth; }
	Integer endMonth() { return endMonth; }
}
