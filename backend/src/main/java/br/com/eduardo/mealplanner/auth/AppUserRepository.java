package br.com.eduardo.mealplanner.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface AppUserRepository extends JpaRepository<AppUser, Long> {
	Optional<AppUser> findByEmail(String email);
	boolean existsByEmail(String email);
}
