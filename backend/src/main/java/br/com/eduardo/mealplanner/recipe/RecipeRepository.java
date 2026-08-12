package br.com.eduardo.mealplanner.recipe;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RecipeRepository extends JpaRepository<Recipe, Long> {
	@Lock(LockModeType.PESSIMISTIC_READ)
	@Query("SELECT recipe FROM Recipe recipe WHERE recipe.id IN :ids")
	List<Recipe> findAllByIdWithSharedLock(@Param("ids") Collection<Long> ids);

	@Query("""
			select recipe from Recipe recipe
			where lower(recipe.name) like concat('%', lower(:query), '%') escape '!'
			order by lower(recipe.name), recipe.id
			""")
	Page<Recipe> searchByNameFragment(@Param("query") String query, Pageable pageable);
	boolean existsByNameIgnoreCase(String name);
	boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
