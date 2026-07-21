import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

const ingredient = {
  id: 1,
  name: "Morango",
  description: "Fruta fresca",
  defaultUnit: "GRAM" as const,
  nutritionPer100g: {
    caloriesKcal: 32,
    proteinGrams: 0.7,
    carbohydrateGrams: 7.7,
    fatGrams: 0.3,
    fiberGrams: 2,
    sodiumMilligrams: 1,
  },
  seasonality: { startMonth: 6, endMonth: 11 },
  createdAt: "2026-07-21T12:00:00Z",
  updatedAt: "2026-07-21T12:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("sends and returns a complete ingredient", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ingredient,
    } as Response);

    const payload = {
      name: ingredient.name,
      description: ingredient.description,
      defaultUnit: ingredient.defaultUnit,
      nutritionPer100g: ingredient.nutritionPer100g,
      seasonality: ingredient.seasonality,
    };
    await expect(api.ingredients.create(payload)).resolves.toEqual(ingredient);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ingredients",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  });

  it("exposes the structured API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        code: "DUPLICATE_RESOURCE",
        message: "Já existe um ingrediente com este nome",
        fieldErrors: {},
      }),
    } as Response);

    await expect(
      api.ingredients.create({ name: "Morango", defaultUnit: "GRAM" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Já existe um ingrediente com este nome",
        status: 409,
      }),
    );
  });
});
