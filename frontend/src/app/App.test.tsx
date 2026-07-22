import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { resetApiSecurityStateForTests } from "../api/client";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      id: 1,
      displayName: "Usuário de Teste",
      email: "teste@example.com",
      role: "USER",
    }),
  } as Response);
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
      screen.getByRole("button", { name: /escolher receitas/i }),
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
