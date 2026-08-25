import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  api,
  resetApiSecurityStateForTests,
} from "../api/client";
import type { WeeklyPlan, WeeklyPlanRecipe } from "../api/types";
import { WeeklyPlanPage } from "./WeeklyPlanPage";

afterEach(() => {
  vi.restoreAllMocks();
  resetApiSecurityStateForTests();
});

describe("WeeklyPlanPage", () => {
  it.each(["invalida", "2026-07-28"])(
    "redirects the invalid week route %s to a Monday",
    async (invalidWeek) => {
      const getPlan = vi
        .spyOn(api.weeklyPlans, "get")
        .mockImplementation((weekStart) =>
          Promise.resolve({ weekStart, recipes: [] }),
        );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/semana/${invalidWeek}`]}>
            <Routes>
              <Route
                path="/semana/:weekStart"
                element={
                  <>
                    <WeeklyPlanPage />
                    <CurrentLocation />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await screen.findByText("Nenhuma receita planejada");
      await waitFor(() =>
        expect(screen.getByTestId("current-location").textContent).toMatch(
          /^\/semana\/[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
        ),
      );
      const canonicalWeek = getPlan.mock.calls.at(-1)?.[0];
      expect(canonicalWeek).toBeDefined();
      expect(canonicalWeek).not.toBe(invalidWeek);
      expect(new Date(`${canonicalWeek}T12:00:00`).getDay()).toBe(1);
      expect(getPlan).not.toHaveBeenCalledWith(invalidWeek);
    },
  );

  it("loads and displays the selected persisted week", async () => {
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        weekStart: "2026-07-27",
        recipes: [
          {
            id: 7,
            name: "Risoto de cogumelos",
            description: "Cremoso e rápido.",
            servings: 4,
            preparationTimeMinutes: 45,
            createdAt: "2026-07-20T12:00:00Z",
            updatedAt: "2026-07-20T12:00:00Z",
            plannedQuantity: 1,
          },
        ],
      }),
    } as Response);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Carregando planejamento…")).toBeInTheDocument();
    expect(await screen.findByText("Risoto de cogumelos")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/weekly-plans/2026-07-27",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("updates how many times a planned recipe will be prepared", async () => {
    const user = userEvent.setup();
    const recipe: WeeklyPlanRecipe = {
      id: 7,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Risoto de cogumelos",
      servings: 4,
      preparationTimeMinutes: 45,
      createdAt: "2026-07-20T12:00:00Z",
      updatedAt: "2026-07-20T12:00:00Z",
      plannedQuantity: 2,
    };
    vi.spyOn(api.weeklyPlans, "get").mockResolvedValue({
      weekStart: "2026-07-27",
      recipes: [recipe],
    });
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    const updateQuantity = vi
      .spyOn(api.weeklyPlans, "updateRecipeQuantity")
      .mockResolvedValue({
        weekStart: "2026-07-27",
        recipes: [{ ...recipe, plannedQuantity: 3 }],
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["shopping-lists", "2026-07-27"], {
      weekStart: "2026-07-27",
      items: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const quantity = await screen.findByRole("spinbutton", {
      name: `Quantidade de ${recipe.name}`,
    });
    expect(quantity).toHaveValue(2);
    await user.clear(quantity);
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Informe um número inteiro entre 1 e 100."),
    ).toBeInTheDocument();
    await user.type(quantity, "3");
    await user.click(
      screen.getByRole("button", {
        name: `Atualizar quantidade de ${recipe.name}`,
      }),
    );

    await waitFor(() =>
      expect(updateQuantity).toHaveBeenCalledWith("2026-07-27", recipe.id, 3),
    );
    expect(quantity).toHaveValue(3);
    expect(await screen.findByRole("status")).toHaveTextContent(
      `Quantidade de ${recipe.name} atualizada.`,
    );
    expect(
      queryClient.getQueryState(["shopping-lists", "2026-07-27"])
        ?.isInvalidated,
    ).toBe(true);
  });

  it("navigates to the previous and next persisted weeks", async () => {
    const user = userEvent.setup();
    const getPlan = vi
      .spyOn(api.weeklyPlans, "get")
      .mockImplementation((weekStart) =>
        Promise.resolve({ weekStart, recipes: [] }),
      );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("Nenhuma receita planejada");
    await user.click(screen.getByRole("button", { name: "Semana anterior" }));
    await waitFor(() => expect(getPlan).toHaveBeenLastCalledWith("2026-07-20"));
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    await waitFor(() => expect(getPlan).toHaveBeenLastCalledWith("2026-07-27"));
  });

  it("searches, adds and removes recipes from the selected week", async () => {
    const user = userEvent.setup();
    const risotto: WeeklyPlanRecipe = {
      id: 7,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Risoto de cogumelos",
      servings: 4,
      preparationTimeMinutes: 45,
      createdAt: "2026-07-20T12:00:00Z",
      updatedAt: "2026-07-20T12:00:00Z",
      plannedQuantity: 1,
    };
    const soup: WeeklyPlanRecipe = {
      ...risotto,
      id: 8,
      name: "Sopa de legumes",
      preparationTimeMinutes: 30,
    };
    let currentPlan: WeeklyPlan = {
      weekStart: "2026-07-27",
      recipes: [risotto],
    };
    vi.spyOn(api.weeklyPlans, "get").mockImplementation(() =>
      Promise.resolve(currentPlan),
    );
    const listRecipes = vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [risotto, soup],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    const addRecipe = vi
      .spyOn(api.weeklyPlans, "addRecipe")
      .mockImplementation((weekStart, recipeId) => {
        currentPlan = { weekStart, recipes: [risotto, soup] };
        expect(recipeId).toBe(soup.id);
        return Promise.resolve(currentPlan);
      });
    const removeRecipe = vi
      .spyOn(api.weeklyPlans, "removeRecipe")
      .mockImplementation((weekStart, recipeId) => {
        currentPlan = { weekStart, recipes: [soup] };
        expect(recipeId).toBe(risotto.id);
        return Promise.resolve();
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(risotto.name);
    const search = screen.getByRole("searchbox", { name: "Buscar receitas" });
    await user.type(search, "sopa");
    await waitFor(() =>
      expect(listRecipes).toHaveBeenLastCalledWith({
        q: "sopa",
        page: 0,
        size: 20,
      }),
    );
    expect(
      screen.getByRole("button", { name: `Adicionar ${soup.name}` }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: `${risotto.name} já planejada` }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: `Adicionar ${soup.name}` }),
    );
    await waitFor(() => expect(addRecipe).toHaveBeenCalledTimes(1));

    await user.click(
      screen.getByRole("button", { name: `Remover ${risotto.name}` }),
    );
    await waitFor(() => expect(removeRecipe).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: `Remover ${risotto.name}` }),
      ).not.toBeInTheDocument(),
    );
  });

  it("updates the original week cache when navigation happens during an addition", async () => {
    const user = userEvent.setup();
    const recipe: WeeklyPlanRecipe = {
      id: 10,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Torta de legumes",
      servings: 6,
      preparationTimeMinutes: 50,
      createdAt: "2026-07-20T12:00:00Z",
      updatedAt: "2026-07-20T12:00:00Z",
      plannedQuantity: 1,
    };
    vi.spyOn(api.weeklyPlans, "get").mockImplementation((weekStart) =>
      Promise.resolve({ weekStart, recipes: [] }),
    );
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [recipe],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    let resolveAddition: (plan: WeeklyPlan) => void = () => undefined;
    vi.spyOn(api.weeklyPlans, "addRecipe").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAddition = resolve;
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: `Adicionar ${recipe.name}` }),
    );
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    await screen.findByText("Nenhuma receita planejada");

    resolveAddition({ weekStart: "2026-07-27", recipes: [recipe] });

    await waitFor(() =>
      expect(
        queryClient.getQueryData<WeeklyPlan>(["weekly-plans", "2026-07-27"]),
      ).toEqual({ weekStart: "2026-07-27", recipes: [recipe] }),
    );
    expect(
      queryClient.getQueryData<WeeklyPlan>(["weekly-plans", "2026-08-03"]),
    ).toEqual({ weekStart: "2026-08-03", recipes: [] });
  });

  it("invalidates the original week when navigation happens during a removal", async () => {
    const user = userEvent.setup();
    const recipe: WeeklyPlanRecipe = {
      id: 11,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Caldo de abóbora",
      servings: 4,
      preparationTimeMinutes: 35,
      createdAt: "2026-07-20T12:00:00Z",
      updatedAt: "2026-07-20T12:00:00Z",
      plannedQuantity: 1,
    };
    vi.spyOn(api.weeklyPlans, "get").mockImplementation((weekStart) =>
      Promise.resolve({
        weekStart,
        recipes: weekStart === "2026-07-27" ? [recipe] : [],
      }),
    );
    let resolveRemoval: () => void = () => undefined;
    vi.spyOn(api.weeklyPlans, "removeRecipe").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemoval = resolve;
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: `Remover ${recipe.name}` }),
    );
    await user.click(screen.getByRole("button", { name: "Próxima semana" }));
    await screen.findByText("Nenhuma receita planejada");

    resolveRemoval();

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["weekly-plans", "2026-07-27"],
      }),
    );
  });

  it("shows a removal error while keeping recipe search available", async () => {
    const user = userEvent.setup();
    const recipe: WeeklyPlanRecipe = {
      id: 9,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Ensopado de legumes",
      servings: 4,
      preparationTimeMinutes: 40,
      createdAt: "2026-07-20T12:00:00Z",
      updatedAt: "2026-07-20T12:00:00Z",
      plannedQuantity: 1,
    };
    vi.spyOn(api.weeklyPlans, "get").mockResolvedValue({
      weekStart: "2026-07-27",
      recipes: [recipe],
    });
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    vi.spyOn(api.weeklyPlans, "removeRecipe").mockRejectedValue(
      new ApiClientError("Não foi possível remover esta receita.", 500),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/semana/2026-07-27"]}>
          <Routes>
            <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: `Remover ${recipe.name}` }),
    );

    expect(
      await screen.findByText("Não foi possível remover esta receita."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar receitas" }),
    ).toBeInTheDocument();
  });
});

function CurrentLocation() {
  return <span data-testid="current-location">{useLocation().pathname}</span>;
}
