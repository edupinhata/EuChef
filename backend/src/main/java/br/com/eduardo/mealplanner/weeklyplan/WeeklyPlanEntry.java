package br.com.eduardo.mealplanner.weeklyplan;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "weekly_plan_entries")
class WeeklyPlanEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private Long userId;
	private LocalDate weekStart;
	private Long recipeId;

	@CreationTimestamp
	private Instant createdAt;

	protected WeeklyPlanEntry() {
	}

	WeeklyPlanEntry(Long userId, LocalDate weekStart, Long recipeId) {
		this.userId = userId;
		this.weekStart = weekStart;
		this.recipeId = recipeId;
	}

	Long recipeId() {
		return recipeId;
	}
}
