package br.com.eduardo.mealplanner.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "app_users")
class AppUser {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String displayName;

	private String email;

	private String passwordHash;

	@Enumerated(EnumType.STRING)
	private AppRole role;

	private boolean enabled;

	@Version
	private long version;

	@CreationTimestamp
	private Instant createdAt;

	@UpdateTimestamp
	private Instant updatedAt;

	protected AppUser() {
	}

	AppUser(String displayName, String email, String passwordHash, AppRole role) {
		this.displayName = displayName;
		this.email = email;
		this.passwordHash = passwordHash;
		this.role = role;
		this.enabled = true;
	}

	Long id() { return id; }
	String displayName() { return displayName; }
	String email() { return email; }
	String passwordHash() { return passwordHash; }
	AppRole role() { return role; }
	boolean enabled() { return enabled; }
}
