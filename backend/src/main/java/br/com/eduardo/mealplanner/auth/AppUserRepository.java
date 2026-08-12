package br.com.eduardo.mealplanner.auth;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface AppUserRepository extends JpaRepository<AppUser, Long> {
	Optional<AppUser> findByEmail(String email);
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select appUser from AppUser appUser where appUser.email = :email")
	Optional<AppUser> findByEmailForUpdate(@Param("email") String email);
	boolean existsByEmail(String email);
}
