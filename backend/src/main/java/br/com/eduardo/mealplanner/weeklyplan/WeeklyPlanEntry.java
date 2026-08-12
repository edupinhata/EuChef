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
	private int plannedQuantity;

	@CreationTimestamp
	private Instant createdAt;

	protected WeeklyPlanEntry() {
	}

	WeeklyPlanEntry(Long userId, LocalDate weekStart, Long recipeId) {
		this(userId, weekStart, recipeId, 1);
	}

	WeeklyPlanEntry(Long userId, LocalDate weekStart, Long recipeId, int plannedQuantity) {
		this.userId = userId;
		this.weekStart = weekStart;
		this.recipeId = recipeId;
		this.plannedQuantity = plannedQuantity;
	}

	Long recipeId() {
		return recipeId;
	}

	int plannedQuantity() {
		return plannedQuantity;
	}

	void updatePlannedQuantity(int quantity) {
		this.plannedQuantity = quantity;
	}
}
