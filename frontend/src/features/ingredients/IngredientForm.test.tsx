import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IngredientForm } from "./IngredientForm";

describe("IngredientForm", () => {
  it("submits nutrition and seasonality when enabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<IngredientForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nome"), "Morango");
    await user.selectOptions(screen.getByLabelText("Unidade padrão"), "GRAM");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Adicionar informações nutricionais",
      }),
    );
    await user.type(screen.getByLabelText("Calorias (kcal)"), "32");
    await user.type(screen.getByLabelText("Fibras (g)"), "2");
    await user.click(
      screen.getByRole("checkbox", { name: "Ingrediente de época" }),
    );
    await user.selectOptions(screen.getByLabelText("Entra em época"), "6");
    await user.selectOptions(screen.getByLabelText("Sai de época"), "11");
    await user.click(
      screen.getByRole("button", { name: "Salvar ingrediente" }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morango",
      description: undefined,
      defaultUnit: "GRAM",
      nutritionPer100g: { caloriesKcal: 32, fiberGrams: 2 },
      seasonality: { startMonth: 6, endMonth: 11 },
    });
  });
});
