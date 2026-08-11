import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { resetApiSecurityStateForTests } from "../api/client";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    const body = path.startsWith("/api/v1/weekly-plans/")
      ? { weekStart: path.split("/").at(-1), recipes: [] }
      : path.startsWith("/api/v1/recipes")
        ? {
            content: [],
            page: 0,
            size: 20,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          }
        : {
            id: 1,
            displayName: "Usuário de Teste",
            email: "teste@example.com",
            role: "USER",
          };
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  resetApiSecurityStateForTests();
});

describe("fundação mobile do planejador", () => {
  it("abre a semana atual e oferece a ação principal", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /minha semana/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("searchbox", { name: /buscar receitas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nenhuma receita planejada/i)).toBeInTheDocument();
  });

  it("navega entre as quatro áreas principais", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("link", { name: /^semana$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /receitas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compras/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /despensa/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /receitas/i }));

    expect(
      screen.getByRole("heading", { name: /suas receitas/i }),
    ).toBeInTheDocument();
  });
});
