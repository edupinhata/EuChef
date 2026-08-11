import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Ingredient } from "../api/types";
import { ApiClientError, api } from "../api/client";
import { RecipeForm } from "../features/recipes/RecipeForm";
import { currentWeekStart } from "../features/weekly-plan/week";

export function RecipesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [debouncedIngredientSearch, setDebouncedIngredientSearch] =
    useState("");
  const [ingredientOptions, setIngredientOptions] = useState<Ingredient[]>([]);
  useEffect(() => {
    if (ingredientSearch.trim() === debouncedIngredientSearch) {
      return;
    }
    const timeout = window.setTimeout(
      () => setDebouncedIngredientSearch(ingredientSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [ingredientSearch, debouncedIngredientSearch]);
  const recipes = useQuery({
    queryKey: ["recipes", page],
    queryFn: () => api.recipes.list({ page, size: 12 }),
    placeholderData: keepPreviousData,
  });
  const recipeDetail = useQuery({
    queryKey: ["recipes", "detail", editingId],
    queryFn: () => api.recipes.get(editingId as number),
    enabled: formOpen && editingId !== null,
  });
  const ingredients = useQuery({
    queryKey: ["ingredients", "recipe-form", debouncedIngredientSearch],
    queryFn: () =>
      api.ingredients.list({
        q: debouncedIngredientSearch,
        page: 0,
        size: 20,
      }),
    enabled: formOpen,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (!ingredients.data) {
      return;
    }
    setIngredientOptions((current) => {
      const byId = new Map(
        current.map((ingredient) => [ingredient.id, ingredient]),
      );
      for (const ingredient of ingredients.data.content) {
        byId.set(ingredient.id, ingredient);
      }
      return Array.from(byId.values()).sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR"),
      );
    });
  }, [ingredients.data]);
  const save = useMutation({
    mutationFn: (payload: Parameters<typeof api.recipes.create>[0]) =>
      editingId === null
        ? api.recipes.create(payload)
        : api.recipes.update(editingId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["shopping-lists"] }),
      ]);
      setFormOpen(false);
      setEditingId(null);
    },
  });
  const remove = useMutation({
    mutationFn: (variables: {
      id: number;
      sourcePage: number;
      wasOnlyItem: boolean;
    }) => api.recipes.delete(variables.id),
    onSuccess: async (_, variables) => {
      if (variables.wasOnlyItem && variables.sourcePage > 0) {
        setPage((current) =>
          current === variables.sourcePage ? current - 1 : current,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recipes"] }),
        queryClient.invalidateQueries({ queryKey: ["weekly-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["shopping-lists"] }),
      ]);
    },
  });
  const addToWeek = useMutation({
    mutationFn: (recipeId: number) =>
      api.weeklyPlans.addRecipe(currentWeekStart(), recipeId),
    onSuccess: async (updatedPlan) => {
      queryClient.setQueryData(
        ["weekly-plans", updatedPlan.weekStart],
        updatedPlan,
      );
      await queryClient.invalidateQueries({
        queryKey: ["shopping-lists", updatedPlan.weekStart],
      });
    },
  });

  function requestDelete(id: number, name: string) {
    if (
      window.confirm(
        `Excluir a receita “${name}”? Esta ação não pode ser desfeita.`,
      )
    ) {
      remove.mutate({
        id,
        sourcePage: recipes.data?.page ?? page,
        wasOnlyItem: (recipes.data?.content.length ?? 0) === 1,
      });
    }
  }

  const recipeItems = recipes.data?.content ?? [];
  const actionsDisabled =
    recipes.isFetching ||
    save.isPending ||
    remove.isPending ||
    addToWeek.isPending;

  return (
    <section className="page" aria-labelledby="recipes-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Acervo</p>
          <h1 id="recipes-title">Suas receitas</h1>
          <p className="page-description">
            Os pratos que você gosta de preparar ficam reunidos aqui.
          </p>
        </div>
        {!formOpen && (
          <button
            className="primary-button compact-button"
            type="button"
            onClick={() => {
              save.reset();
              setEditingId(null);
              setFormOpen(true);
            }}
          >
            <span aria-hidden="true">＋</span> Nova receita
          </button>
        )}
      </div>

      {formOpen && (
        <section className="editor-card" aria-labelledby="recipe-form-title">
          <div className="section-heading">
            <p className="eyebrow">
              {editingId === null ? "Novo cadastro" : "Atualização"}
            </p>
            <h2 id="recipe-form-title">
              {editingId === null ? "Adicionar receita" : "Editar receita"}
            </h2>
          </div>
          {ingredients.isError && (
            <div className="form-alert" role="alert">
              <p>Não foi possível carregar os ingredientes.</p>
              <button
                className="text-button"
                type="button"
                onClick={() => void ingredients.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {ingredients.isLoading && <p>Carregando ingredientes…</p>}
          {editingId !== null && recipeDetail.isLoading && (
            <p>Carregando receita…</p>
          )}
          {recipeDetail.isError && (
            <div className="form-alert" role="alert">
              Não foi possível carregar a receita para edição.
            </div>
          )}
          {ingredients.data && (editingId === null || recipeDetail.data) && (
            <RecipeForm
              key={editingId ?? "new"}
              ingredients={ingredientOptions}
              ingredientSearch={ingredientSearch}
              onIngredientSearch={setIngredientSearch}
              initialData={recipeDetail.data}
              onSubmit={async (payload) => {
                try {
                  await save.mutateAsync(payload);
                } catch {
                  // The mutation state renders the API error in RecipeForm.
                }
              }}
              onCancel={() => {
                save.reset();
                setFormOpen(false);
                setEditingId(null);
              }}
              pending={save.isPending}
              error={errorMessage(save.error)}
            />
          )}
        </section>
      )}

      {recipes.isLoading && (
        <p className="status-message">Carregando receitas…</p>
      )}

      {recipes.isError && (
        <div className="form-alert" role="alert">
          Não foi possível carregar as receitas. Confirme se o backend está em
          execução.
        </div>
      )}

      {recipes.data && recipeItems.length === 0 && !formOpen && (
        <div className="empty-state">
          <span className="line-icon" aria-hidden="true">
            ◌
          </span>
          <div>
            <h2>Nenhuma receita cadastrada</h2>
            <p>Comece registrando um prato que você gosta de preparar.</p>
          </div>
        </div>
      )}

      {recipeItems.length > 0 && (
        <div className="card-list" aria-label="Receitas cadastradas">
          {recipeItems.map((recipe) => (
            <article className="catalog-card" key={recipe.id}>
              <div className="catalog-card__body">
                <div className="catalog-card__title">
                  <h2>{recipe.name}</h2>
                </div>
                {recipe.description && <p>{recipe.description}</p>}
                <div className="metadata-row">
                  <span>{recipe.preparationTimeMinutes} min</span>
                  <span>
                    {recipe.servings}{" "}
                    {recipe.servings === 1 ? "porção" : "porções"}
                  </span>
                </div>
                <div className="card-actions">
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Adicionar ${recipe.name} à semana atual`}
                    disabled={actionsDisabled}
                    onClick={() => addToWeek.mutate(recipe.id)}
                  >
                    Adicionar à semana
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Editar ${recipe.name}`}
                    disabled={actionsDisabled}
                    onClick={() => {
                      save.reset();
                      setEditingId(recipe.id);
                      setFormOpen(true);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    aria-label={`Excluir ${recipe.name}`}
                    disabled={actionsDisabled}
                    onClick={() => requestDelete(recipe.id, recipe.name)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {remove.isError && (
        <div className="form-alert" role="alert">
          {errorMessage(remove.error) ?? "Não foi possível excluir a receita."}
        </div>
      )}

      {addToWeek.isError && (
        <div className="form-alert" role="alert">
          {errorMessage(addToWeek.error) ??
            "Não foi possível adicionar a receita à semana atual."}
        </div>
      )}

      {addToWeek.isSuccess && (
        <p className="status-message" role="status">
          Receita adicionada ao planejamento da semana atual.
        </p>
      )}

      {recipes.data && recipes.data.totalPages > 1 && (
        <nav className="pagination" aria-label="Paginação de receitas">
          <button
            className="text-button"
            type="button"
            disabled={!recipes.data.hasPrevious || actionsDisabled}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Página anterior
          </button>
          <span aria-live="polite">
            Página {recipes.data.page + 1} de {recipes.data.totalPages}
          </span>
          <button
            className="text-button"
            type="button"
            disabled={!recipes.data.hasNext || actionsDisabled}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima página
          </button>
        </nav>
      )}
    </section>
  );
}

function errorMessage(error: Error | null) {
  return error instanceof ApiClientError ? error.message : error?.message;
}
