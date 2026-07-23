package br.com.eduardo.mealplanner.web;

import java.util.List;
import org.springframework.data.domain.Page;

public record PagedResponse<T>(
		List<T> content,
		int page,
		int size,
		long totalElements,
		int totalPages,
		boolean hasNext,
		boolean hasPrevious) {

	public static <T> PagedResponse<T> from(Page<T> page) {
		return new PagedResponse<>(page.getContent(), page.getNumber(), page.getSize(),
				page.getTotalElements(), page.getTotalPages(), page.hasNext(), page.hasPrevious());
	}
}
