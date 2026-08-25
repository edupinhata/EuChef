import type { AuthenticatedUser, RecipeSummary } from "../../api/types";

export function canManageRecipe(
  user: AuthenticatedUser | undefined,
  recipe: RecipeSummary,
) {
  return (
    user !== undefined &&
    (user.role === "ADMIN" || user.id === recipe.author.id)
  );
}
