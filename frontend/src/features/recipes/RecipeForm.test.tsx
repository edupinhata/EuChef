import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Ingredient, Recipe } from "../../api/types";
import { RecipeForm } from "./RecipeForm";

const ingredients: Ingredient[] = [
  {
    id: 7,
    name: "Tomate",
    defaultUnit: "GRAM",
    createdAt: "2026-07-27T12:00:00Z",
    updatedAt: "2026-07-27T12:00:00Z",
  },
  {
    id: 8,
    name: "Arroz",
    defaultUnit: "GRAM",
    createdAt: "2026-07-27T12:00:00Z",
    updatedAt: "2026-07-27T12:00:00Z",
  },
];

describe("RecipeForm", () => {
  it("submits a normalized recipe payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm ingredients={ingredients} onSubmit={onSubmit} />);

    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "  Arroz com tomate  ",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Descrição (opcional)" }),
      "  Receita simples  ",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Porções" }));
    await user.type(screen.getByRole("spinbutton", { name: "Porções" }), "3");
    await user.clear(
      screen.getByRole("spinbutton", { name: "Tempo de preparo (minutos)" }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Tempo de preparo (minutos)" }),
      "25",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 1" }),
      "7",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Quantidade 1" }));
    await user.type(
      screen.getByRole("spinbutton", { name: "Quantidade 1" }),
      "1.001",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Unidade 1" }),
      "GRAM",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Passo 1" }),
      "  Misture tudo.  ",
    );
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Arroz com tomate",
      description: "Receita simples",
      servings: 3,
      preparationTimeMinutes: 25,
      ingredients: [
        {
          ingredientId: 7,
          quantity: 1.001,
          unit: "GRAM",
          notes: undefined,
        },
      ],
      preparationSteps: ["Misture tudo."],
    });
  });

  it("keeps multiple ingredients and reordered steps in visual order", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm ingredients={ingredients} onSubmit={onSubmit} />);

    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "Arroz especial",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 1" }),
      "8",
    );
    await user.click(
      screen.getByRole("button", { name: "Adicionar ingrediente" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 2" }),
      "7",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Quantidade 2" }));
    await user.type(
      screen.getByRole("spinbutton", { name: "Quantidade 2" }),
      "2.5",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Unidade 2" }),
      "UNIT",
    );

    await user.type(
      screen.getByRole("textbox", { name: "Passo 1" }),
      "Cozinhe o arroz.",
    );
    await user.click(screen.getByRole("button", { name: "Adicionar passo" }));
    await user.type(
      screen.getByRole("textbox", { name: "Passo 2" }),
      "Junte o tomate.",
    );
    await user.click(screen.getByRole("button", { name: "Adicionar passo" }));
    await user.type(
      screen.getByRole("textbox", { name: "Passo 3" }),
      "Sirva quente.",
    );
    await user.click(
      screen.getByRole("button", { name: "Mover passo 3 para cima" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [
          expect.objectContaining({ ingredientId: 8 }),
          expect.objectContaining({
            ingredientId: 7,
            quantity: 2.5,
            unit: "UNIT",
          }),
        ],
        preparationSteps: [
          "Cozinhe o arroz.",
          "Sirva quente.",
          "Junte o tomate.",
        ],
      }),
    );
  });

  it("rejects duplicate ingredients", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm ingredients={ingredients} onSubmit={onSubmit} />);

    await user.type(
      screen.getByRole("textbox", { name: "Nome" }),
      "Tomate assado",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 1" }),
      "7",
    );
    await user.click(
      screen.getByRole("button", { name: "Adicionar ingrediente" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 2" }),
      "7",
    );
    await user.type(screen.getByRole("textbox", { name: "Passo 1" }), "Asse.");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    expect(
      await screen.findByText("Este ingrediente já foi adicionado."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hydrates an existing recipe and orders its steps by position", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const existing: Recipe = {
      id: 21,
      name: "Arroz de forno",
      description: "Receita de família",
      servings: 6,
      preparationTimeMinutes: 50,
      ingredients: [
        {
          ingredientId: 99,
          ingredientName: "Ingrediente fora da busca",
          quantity: 300,
          unit: "GRAM",
        },
      ],
      preparationSteps: [
        { position: 2, instruction: "Leve ao forno." },
        { position: 1, instruction: "Misture os ingredientes." },
      ],
      createdAt: "2026-07-27T12:00:00Z",
      updatedAt: "2026-07-27T12:00:00Z",
    };

    render(
      <RecipeForm
        ingredients={ingredients}
        initialData={existing}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue(
      "Arroz de forno",
    );
    expect(screen.getByRole("combobox", { name: "Ingrediente 1" })).toHaveValue(
      "99",
    );
    expect(
      screen.getByRole("option", { name: "Ingrediente fora da busca" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Passo 1" })).toHaveValue(
      "Misture os ingredientes.",
    );
    expect(screen.getByRole("textbox", { name: "Passo 2" })).toHaveValue(
      "Leve ao forno.",
    );
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Arroz de forno",
        preparationSteps: ["Misture os ingredientes.", "Leve ao forno."],
      }),
    );
  });

  it("blocks blank text and invalid numeric values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RecipeForm ingredients={ingredients} onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "Nome" }), "   ");
    await user.clear(screen.getByRole("spinbutton", { name: "Porções" }));
    await user.clear(
      screen.getByRole("spinbutton", { name: "Tempo de preparo (minutos)" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ingrediente 1" }),
      "7",
    );
    const quantity = screen.getByRole("spinbutton", { name: "Quantidade 1" });
    await user.clear(quantity);
    await user.type(quantity, "100000000.00000001");
    const step = screen.getByRole("textbox", { name: "Passo 1" });
    await user.type(step, "   ");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(
      await screen.findByText("Use pelo menos 2 caracteres."),
    ).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Use pelo menos 2 caracteres.");
    expect(
      screen.getByText("Informe um número inteiro entre 1 e 1000."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informe minutos inteiros entre 0 e 10080."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use uma quantidade válida com até três casas decimais.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Descreva este passo.")).toBeInTheDocument();
    expect(step).toHaveAttribute("aria-invalid", "true");
    expect(step).toHaveAccessibleDescription("Descreva este passo.");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
