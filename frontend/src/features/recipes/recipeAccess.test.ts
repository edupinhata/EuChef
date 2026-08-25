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

  it("allows the recipe author to manage it", () => {
    expect(
      canManageRecipe(
        {
          id: recipe.author.id,
          displayName: "Ana",
          email: "ana@example.com",
          role: "USER",
        },
        recipe,
      ),
    ).toBe(true);
  });

  it("allows an admin who is not the author to manage it", () => {
    expect(
      canManageRecipe(
        {
          id: 99,
          displayName: "Admin",
          email: "admin@example.com",
          role: "ADMIN",
        },
        recipe,
      ),
    ).toBe(true);
  });

  it("denies another regular user", () => {
    expect(
      canManageRecipe(
        {
          id: 99,
          displayName: "Bruno",
          email: "bruno@example.com",
          role: "USER",
        },
        recipe,
      ),
    ).toBe(false);
  });
});
