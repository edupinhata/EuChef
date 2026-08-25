import { describe, expect, it } from "vitest";
import type { RecipeSummary } from "../../api/types";
import { canManageRecipe } from "./recipeAccess";

const recipe: RecipeSummary = {
  id: 7,
  name: "Sopa da autora",
  servings: 2,
  preparationTimeMinutes: 30,
  author: { id: 11, displayName: "Ana" },
  createdAt: "2026-08-12T12:00:00Z",
  updatedAt: "2026-08-12T12:00:00Z",
};

describe("canManageRecipe", () => {
  it("denies management when the authenticated user is unavailable", () => {
    expect(canManageRecipe(undefined, recipe)).toBe(false);
  });
});
