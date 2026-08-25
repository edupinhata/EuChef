package br.com.eduardo.mealplanner.auth;

import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AuthService implements UserDetailsService, UserIdentityProvider {

	private final AppUserRepository repository;
	private final PasswordEncoder passwordEncoder;

	AuthService(AppUserRepository repository, PasswordEncoder passwordEncoder) {
		this.repository = repository;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	AuthenticatedUserResponse register(RegistrationRequest request) {
		var email = normalizeEmail(request.email());
		if (repository.existsByEmail(email)) {
			throw new EmailAlreadyRegisteredException();
		}

		var user = new AppUser(
				request.displayName().strip(),
				email,
				passwordEncoder.encode(request.password()),
				AppRole.USER);
		try {
			return AuthenticatedUserResponse.from(repository.saveAndFlush(user));
		} catch (DataIntegrityViolationException exception) {
			throw new EmailAlreadyRegisteredException();
		}
	}

	@Transactional(readOnly = true)
	AuthenticatedUserResponse findAuthenticated(String email) {
		return repository.findByEmail(normalizeEmail(email))
				.map(AuthenticatedUserResponse::from)
				.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
	}

	@Override
	@Transactional(readOnly = true)
	public Long requireUserId(String email) {
		return repository.findByEmail(normalizeEmail(email))
				.map(AppUser::id)
				.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
	}

	@Override
	@Transactional
	public Long requireUserIdForUpdate(String email) {
		return repository.findByEmailForUpdate(normalizeEmail(email))
				.map(AppUser::id)
				.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
	}

	@Override
	@Transactional(readOnly = true)
	public UserIdentity requireUser(String email) {
		return repository.findByEmail(normalizeEmail(email))
				.map(AuthService::toIdentity)
				.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
	}

	@Override
	@Transactional(readOnly = true)
	public Map<Long, UserIdentity> requireUsers(Collection<Long> ids) {
		long expected = ids.stream().distinct().count();
		Map<Long, UserIdentity> identities = repository.findAllById(ids).stream()
				.map(AuthService::toIdentity)
				.collect(Collectors.toMap(UserIdentity::id, Function.identity()));
		if (identities.size() != expected) {
			throw new UsernameNotFoundException("Usuário não encontrado");
		}
		return identities;
	}

	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String username) {
		var user = repository.findByEmail(normalizeEmail(username))
				.orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
		return User.withUsername(user.email())
				.password(user.passwordHash())
				.roles(user.role().name())
				.disabled(!user.enabled())
				.build();
	}

	static String normalizeEmail(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

	private static UserIdentity toIdentity(AppUser user) {
		return new UserIdentity(user.id(), user.displayName());
	}
}
