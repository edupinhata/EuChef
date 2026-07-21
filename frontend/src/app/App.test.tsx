import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("fundação mobile do planejador", () => {
  it("abre a semana atual e oferece a ação principal", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /minha semana/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /escolher receitas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nenhuma receita planejada/i)).toBeInTheDocument();
  });

  it("navega entre as quatro áreas principais", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("link", { name: /^semana$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /receitas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compras/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /despensa/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /receitas/i }));

    expect(
      screen.getByRole("heading", { name: /suas receitas/i }),
    ).toBeInTheDocument();
  });
});
