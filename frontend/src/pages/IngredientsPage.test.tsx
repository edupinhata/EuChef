import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Ingredient, PagedResponse } from "../api/types";
import { IngredientsPage } from "./IngredientsPage";

const ingredient: Ingredient = {
  id: 1,
  name: "Tomate",
  defaultUnit: "GRAM",
  createdAt: "2026-07-22T12:00:00Z",
  updatedAt: "2026-07-22T12:00:00Z",
};

const page: PagedResponse<Ingredient> = {
  content: [ingredient],
  page: 0,
  size: 20,
  totalElements: 21,
  totalPages: 2,
  hasNext: true,
  hasPrevious: false,
};

afterEach(() => vi.restoreAllMocks());

describe("IngredientsPage", () => {
  it("searches and navigates through paged ingredients", async () => {
    const user = userEvent.setup();
    const list = vi.spyOn(api.ingredients, "list").mockResolvedValue(page);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <IngredientsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Tomate")).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith({ q: "", page: 0, size: 20 });

    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ q: "", page: 1, size: 20 }),
    );

    const searchbox = screen.getByRole("searchbox", {
      name: "Buscar ingredientes",
    });
    expect(searchbox).toHaveAttribute("maxLength", "100");
    expect(searchbox).toHaveAttribute("placeholder", "Digite parte do nome");
    await user.type(searchbox, "Tom");
    expect(list).not.toHaveBeenCalledWith({ q: "T", page: 0, size: 20 });
    expect(list).not.toHaveBeenCalledWith({ q: "To", page: 0, size: 20 });
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ q: "Tom", page: 0, size: 20 }),
    );
  });

  it("returns to the last available page when the current page becomes empty", async () => {
    const user = userEvent.setup();
    const outOfRange: PagedResponse<Ingredient> = {
      content: [],
      page: 1,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: true,
    };
    const list = vi
      .spyOn(api.ingredients, "list")
      .mockImplementation((query = {}) =>
        Promise.resolve(query.page === 1 ? outOfRange : page),
      );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <IngredientsPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Tomate");
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ q: "", page: 1, size: 20 }),
    );
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ q: "", page: 0, size: 20 }),
    );
  });

  it("distinguishes an empty search from an empty catalog", async () => {
    const user = userEvent.setup();
    const empty: PagedResponse<Ingredient> = {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    };
    vi.spyOn(api.ingredients, "list").mockImplementation((query = {}) =>
      Promise.resolve(query.q ? empty : page),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <IngredientsPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Tomate");
    await user.type(
      screen.getByRole("searchbox", { name: "Buscar ingredientes" }),
      "Inexistente",
    );

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum ingrediente encontrado",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar primeiro ingrediente" }),
    ).not.toBeInTheDocument();
  });
});
