import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { PagedResponse, Recipe, RecipeSummary } from "../api/types";
import { currentWeekStart } from "../features/weekly-plan/week";
import { RecipesPage } from "./RecipesPage";

const owner = {
  id: 1,
  displayName: "Ana Souza",
  email: "ana@example.com",
  role: "USER" as const,
};

const recipe: RecipeSummary = {
  id: 1,
  author: { id: 1, displayName: "Ana Souza" },
  name: "Risoto de cogumelos",
  description: "Cremoso e finalizado com parmesão.",
  servings: 4,
  preparationTimeMinutes: 45,
  createdAt: "2026-07-27T12:00:00Z",
  updatedAt: "2026-07-27T12:00:00Z",
};

const page: PagedResponse<RecipeSummary> = {
  content: [recipe],
  page: 0,
  size: 12,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

const fullRecipe: Recipe = {
  ...recipe,
  youtubeVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ingredients: [
    {
      ingredientId: 7,
      ingredientName: "Cogumelo",
      quantity: 200,
      unit: "GRAM",
    },
  ],
  preparationSteps: [{ position: 1, instruction: "Cozinhe o risoto." }],
};

const secondRecipe: RecipeSummary = {
  ...recipe,
  id: 2,
  name: "Sopa de legumes",
};

const secondFullRecipe: Recipe = {
  ...fullRecipe,
  ...secondRecipe,
  preparationSteps: [{ position: 1, instruction: "Cozinhe os legumes." }],
};

afterEach(() => vi.restoreAllMocks());

describe("RecipesPage", () => {
  it("shows authorship and hides management actions for another user's recipe", async () => {
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage
          user={{
            id: 2,
            displayName: "Bruno Lima",
            email: "bruno@example.com",
            role: "USER",
          }}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Por Ana Souza")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Editar ${recipe.name}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Excluir ${recipe.name}` }),
    ).not.toBeInTheDocument();
  });
  it("loads and displays recipe summaries", async () => {
    const list = vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Carregando receitas…")).toBeInTheDocument();
    expect(await screen.findByText("Risoto de cogumelos")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("4 porções")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 0, size: 12 });
  });

  it("adds a catalog recipe to the current weekly plan", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    const addRecipe = vi
      .spyOn(api.weeklyPlans, "addRecipe")
      .mockImplementation((weekStart) =>
        Promise.resolve({
          weekStart,
          recipes: [{ ...recipe, plannedQuantity: 1 }],
        }),
      );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const currentWeek = currentWeekStart();
    queryClient.setQueryData(["shopping-lists", currentWeek], {
      weekStart: currentWeek,
      items: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: `Adicionar ${recipe.name} à semana atual`,
      }),
    );

    await waitFor(() => expect(addRecipe).toHaveBeenCalledTimes(1));
    const weekStart = addRecipe.mock.calls[0]?.[0];
    expect(weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${weekStart}T12:00:00`).getDay()).toBe(1);
    expect(addRecipe).toHaveBeenCalledWith(weekStart, recipe.id);
    expect(
      queryClient.getQueryState(["shopping-lists", currentWeek])?.isInvalidated,
    ).toBe(true);
  });

  it("explains when the recipe catalog is empty", async () => {
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 12,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Nenhuma receita cadastrada",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Comece registrando um prato que você gosta de preparar.",
      ),
    ).toBeInTheDocument();
  });

  it("alerts when recipes cannot be loaded", async () => {
    vi.spyOn(api.recipes, "list").mockRejectedValue(new Error("offline"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as receitas.",
    );
  });

  it("navigates through paged recipes", async () => {
    const user = userEvent.setup();
    const firstPage = {
      ...page,
      totalElements: 13,
      totalPages: 2,
      hasNext: true,
    };
    const secondPage = {
      ...page,
      page: 1,
      totalElements: 13,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
    };
    const list = vi
      .spyOn(api.recipes, "list")
      .mockImplementation((query = {}) =>
        Promise.resolve(query.page === 1 ? secondPage : firstPage),
      );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText("Risoto de cogumelos");
    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ page: 1, size: 12 }),
    );
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
  });

  it("disables actions over placeholder data while changing pages", async () => {
    const user = userEvent.setup();
    const firstPage = {
      ...page,
      totalElements: 13,
      totalPages: 2,
      hasNext: true,
    };
    const secondPage = {
      ...page,
      content: [secondRecipe],
      page: 1,
      totalElements: 13,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
    };
    let resolveSecondPage!: (value: PagedResponse<RecipeSummary>) => void;
    const pendingSecondPage = new Promise<PagedResponse<RecipeSummary>>(
      (resolve) => {
        resolveSecondPage = resolve;
      },
    );
    vi.spyOn(api.recipes, "list").mockImplementation((query = {}) =>
      query.page === 1 ? pendingSecondPage : Promise.resolve(firstPage),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(
      screen.getByRole("button", { name: `Editar ${recipe.name}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Excluir ${recipe.name}` }),
    ).toBeDisabled();

    resolveSecondPage(secondPage);
    expect(await screen.findByText(secondRecipe.name)).toBeInTheDocument();
  });

  it("reports when ingredients cannot be loaded for the recipe form", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      ...page,
      content: [],
      totalElements: 0,
      totalPages: 0,
    });
    const ingredientsList = vi
      .spyOn(api.ingredients, "list")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "Nenhuma receita cadastrada" });
    await user.click(screen.getByRole("button", { name: "Nova receita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os ingredientes.",
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByRole("textbox", { name: "Nome" }),
    ).toBeInTheDocument();
    expect(ingredientsList).toHaveBeenCalledTimes(2);
  });

  it("creates a recipe using the available ingredients", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 12,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    const ingredientsList = vi
      .spyOn(api.ingredients, "list")
      .mockResolvedValue({
        content: [
          {
            id: 7,
            name: "Tomate",
            defaultUnit: "GRAM",
            createdAt: "2026-07-27T12:00:00Z",
            updatedAt: "2026-07-27T12:00:00Z",
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    const create = vi.spyOn(api.recipes, "create").mockResolvedValue({
      id: 9,
      author: { id: 1, displayName: "Ana Souza" },
      name: "Arroz com tomate",
      servings: 2,
      preparationTimeMinutes: 20,
      ingredients: [
        {
          ingredientId: 7,
          ingredientName: "Tomate",
          quantity: 100,
          unit: "GRAM",
        },
      ],
      preparationSteps: [{ position: 1, instruction: "Misture." }],
      createdAt: "2026-07-27T12:00:00Z",
      updatedAt: "2026-07-27T12:00:00Z",
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
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "Nenhuma receita cadastrada" });
    await user.click(screen.getByRole("button", { name: "Nova receita" }));

    expect(
      screen.getByRole("heading", { name: "Adicionar receita" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Tomate" }),
    ).toBeInTheDocument();
    expect(ingredientsList).toHaveBeenCalledWith({ q: "", page: 0, size: 20 });
    await user.type(
      screen.getByRole("searchbox", {
        name: "Buscar ingredientes para a receita",
      }),
      "Tom",
    );
    await waitFor(() =>
      expect(ingredientsList).toHaveBeenLastCalledWith({
        q: "Tom",
        page: 0,
        size: 20,
      }),
    );

    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "Arroz com tomate",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Porções" }));
    await user.type(screen.getByRole("spinbutton", { name: "Porções" }), "2");
    await user.clear(
      screen.getByRole("spinbutton", { name: "Tempo de preparo (minutos)" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Tempo de preparo (minutos)" }),
      "20",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Vídeo do YouTube (opcional)" }),
      "https://youtu.be/dQw4w9WgXcQ",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 1" }),
      "7",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Quantidade 1" }));
    await user.type(
      screen.getByRole("spinbutton", { name: "Quantidade 1" }),
      "100",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Passo 1" }),
      "Misture.",
    );
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: "Arroz com tomate",
        description: undefined,
        servings: 2,
        preparationTimeMinutes: 20,
        youtubeVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
        ingredients: [
          {
            ingredientId: 7,
            quantity: 100,
            unit: "GRAM",
            notes: undefined,
          },
        ],
        preparationSteps: ["Misture."],
      }),
    );
    expect(
      queryClient.getQueryState(["shopping-lists", "2026-07-27"])
        ?.isInvalidated,
    ).toBe(true);
  });

  it("shows ingredients and preparation before the privacy-enhanced video", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    vi.spyOn(api.recipes, "get").mockResolvedValue(fullRecipe);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: `Ver ${recipe.name}` }),
    );

    expect(await screen.findByText("200 GRAM de Cogumelo")).toBeInTheDocument();
    expect(screen.getByText("Cozinhe o risoto.")).toBeInTheDocument();
    const video = screen.getByTitle(`Vídeo da receita ${recipe.name}`);
    expect(video).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(video).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-presentation",
    );
    for (const heading of ["Ingredientes", "Modo de preparo"]) {
      expect(
        screen
          .getByRole("heading", { name: heading })
          .compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("does not embed a YouTube URL outside the accepted contract", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    vi.spyOn(api.recipes, "get").mockResolvedValue({
      ...fullRecipe,
      youtubeVideoUrl: "https://youtu.be/dQw4w9WgXcQinvalid-suffix",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: `Ver ${recipe.name}` }),
    );

    expect(await screen.findByText("Cozinhe o risoto.")).toBeInTheDocument();
    expect(
      screen.queryByTitle(`Vídeo da receita ${recipe.name}`),
    ).not.toBeInTheDocument();
  });

  it("loads the complete recipe and updates it", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    vi.spyOn(api.recipes, "get").mockResolvedValue(fullRecipe);
    vi.spyOn(api.ingredients, "list").mockResolvedValue({
      content: [
        {
          id: 7,
          name: "Cogumelo",
          defaultUnit: "GRAM",
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    const update = vi.spyOn(api.recipes, "update").mockResolvedValue({
      ...fullRecipe,
      name: "Risoto especial",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(
      screen.getByRole("button", { name: `Editar ${recipe.name}` }),
    );
    expect(
      await screen.findByRole("heading", { name: "Editar receita" }),
    ).toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(name).toHaveValue(recipe.name);
    await user.clear(name);
    await user.type(name, "Risoto especial");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        recipe.id,
        expect.objectContaining({ name: "Risoto especial" }),
      ),
    );
  });

  it("switches cached recipe details without keeping stale form values", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      ...page,
      content: [recipe, secondRecipe],
      totalElements: 2,
    });
    vi.spyOn(api.ingredients, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    vi.spyOn(api.recipes, "get").mockImplementation((id) =>
      Promise.resolve(id === secondRecipe.id ? secondFullRecipe : fullRecipe),
    );
    let resolveUpdate!: (value: Recipe) => void;
    const pendingUpdate = new Promise<Recipe>((resolve) => {
      resolveUpdate = resolve;
    });
    const update = vi
      .spyOn(api.recipes, "update")
      .mockReturnValue(pendingUpdate);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["recipes", "detail", recipe.id], fullRecipe);
    queryClient.setQueryData(
      ["recipes", "detail", secondRecipe.id],
      secondFullRecipe,
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(
      screen.getByRole("button", { name: `Editar ${recipe.name}` }),
    );
    expect(await screen.findByRole("textbox", { name: "Nome" })).toHaveValue(
      recipe.name,
    );

    await user.click(
      screen.getByRole("button", { name: `Editar ${secondRecipe.name}` }),
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue(
        secondRecipe.name,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(secondRecipe.id, expect.any(Object)),
    );
    expect(
      screen.getByRole("button", { name: `Editar ${recipe.name}` }),
    ).toBeDisabled();
    await act(async () => {
      resolveUpdate(secondFullRecipe);
      await pendingUpdate;
    });
  });

  it("clears a failed save error before editing another recipe", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue({
      ...page,
      content: [recipe, secondRecipe],
      totalElements: 2,
    });
    vi.spyOn(api.recipes, "get").mockImplementation((id) =>
      Promise.resolve(id === secondRecipe.id ? secondFullRecipe : fullRecipe),
    );
    vi.spyOn(api.ingredients, "list").mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    vi.spyOn(api.recipes, "update").mockRejectedValue(
      new Error("Falha antiga ao salvar."),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(
      screen.getByRole("button", { name: `Editar ${recipe.name}` }),
    );
    await screen.findByRole("textbox", { name: "Nome" });
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha antiga ao salvar.",
    );

    await user.click(
      screen.getByRole("button", { name: `Editar ${secondRecipe.name}` }),
    );
    expect(await screen.findByRole("textbox", { name: "Nome" })).toHaveValue(
      secondRecipe.name,
    );
    expect(
      screen.queryByText("Falha antiga ao salvar."),
    ).not.toBeInTheDocument();
  });

  it("deletes a recipe only after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    const remove = vi.spyOn(api.recipes, "delete").mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["shopping-lists", "2026-07-27"], {
      weekStart: "2026-07-27",
      items: [],
    });
    queryClient.setQueryData(["weekly-plans", "2026-07-27"], {
      weekStart: "2026-07-27",
      recipes: [{ ...recipe, plannedQuantity: 1 }],
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(
      screen.getByRole("button", { name: `Excluir ${recipe.name}` }),
    );

    expect(confirm).toHaveBeenCalledWith(
      `Excluir a receita “${recipe.name}”? Esta ação não pode ser desfeita.`,
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith(recipe.id));
    expect(
      queryClient.getQueryState(["shopping-lists", "2026-07-27"])
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(["weekly-plans", "2026-07-27"])?.isInvalidated,
    ).toBe(true);
  });

  it("returns to the previous page after deleting its only recipe", async () => {
    const user = userEvent.setup();
    const firstPage = {
      ...page,
      totalElements: 13,
      totalPages: 2,
      hasNext: true,
    };
    const lastPage = {
      ...page,
      content: [secondRecipe],
      page: 1,
      totalElements: 13,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
    };
    const list = vi
      .spyOn(api.recipes, "list")
      .mockImplementation((query = {}) =>
        Promise.resolve(query.page === 1 ? lastPage : firstPage),
      );
    vi.spyOn(api.recipes, "delete").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    await user.click(screen.getByRole("button", { name: "Próxima página" }));
    await screen.findByText(secondRecipe.name);
    await user.click(
      screen.getByRole("button", { name: `Excluir ${secondRecipe.name}` }),
    );

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ page: 0, size: 12 }),
    );
    expect(await screen.findByText(recipe.name)).toBeInTheDocument();
  });

  it("keeps the recipe when deletion is cancelled and reports API failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(api.recipes, "list").mockResolvedValue(page);
    const remove = vi
      .spyOn(api.recipes, "delete")
      .mockRejectedValue(new Error("Falha controlada ao excluir."));
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RecipesPage user={owner} />
      </QueryClientProvider>,
    );

    await screen.findByText(recipe.name);
    const deleteButton = screen.getByRole("button", {
      name: `Excluir ${recipe.name}`,
    });
    await user.click(deleteButton);
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(recipe.name)).toBeInTheDocument();

    await user.click(deleteButton);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha controlada ao excluir.",
    );
    expect(remove).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
