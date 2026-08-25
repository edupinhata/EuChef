package br.com.eduardo.mealplanner.auth;

import java.util.Collection;
import java.util.Map;

public interface UserIdentityProvider {
	Long requireUserId(String email);
	Long requireUserIdForUpdate(String email);
	UserIdentity requireUser(String email);
	Map<Long, UserIdentity> requireUsers(Collection<Long> ids);
}
