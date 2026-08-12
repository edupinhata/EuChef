import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClientError, api } from "../api/client";
import {
  currentWeekStart,
  isValidWeekStart,
  shiftWeek,
  weekLabel,
} from "../features/weekly-plan/week";

interface WeeklyPlanRecipeMutation {
  weekStart: string;
  recipeId: number;
}

interface WeeklyPlanQuantityMutation extends WeeklyPlanRecipeMutation {
  quantity: number;
}

export function WeeklyPlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { weekStart: routeWeekStart } = useParams();
  const requestedWeekStart =
    routeWeekStart && routeWeekStart !== "atual"
      ? routeWeekStart
      : currentWeekStart();
  const weekStart = isValidWeekStart(requestedWeekStart)
    ? requestedWeekStart
    : currentWeekStart();
  useEffect(() => {
    if (
      routeWeekStart &&
      routeWeekStart !== "atual" &&
      routeWeekStart !== weekStart
    ) {
      navigate(`/semana/${weekStart}`, { replace: true });
    }
  }, [navigate, routeWeekStart, weekStart]);
  const plan = useQuery({
    queryKey: ["weekly-plans", weekStart],
    queryFn: () => api.weeklyPlans.get(weekStart),
  });
  const [recipeSearch, setRecipeSearch] = useState("");
  const [plannedQuantities, setPlannedQuantities] = useState<
    Record<number, string>
  >({});
  const [quantityStatus, setQuantityStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!plan.data) return;
    setPlannedQuantities(
      Object.fromEntries(
        plan.data.recipes.map((recipe) => [
          recipe.id,
          String(recipe.plannedQuantity),
        ]),
      ),
    );
  }, [plan.data]);
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState("");
  useEffect(() => {
    if (recipeSearch.trim() === debouncedRecipeSearch) return;
    const timeout = window.setTimeout(
      () => setDebouncedRecipeSearch(recipeSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [recipeSearch, debouncedRecipeSearch]);
  const availableRecipes = useQuery({
    queryKey: ["recipes", "weekly-plan", debouncedRecipeSearch],
    queryFn: () =>
      api.recipes.list({
        q: debouncedRecipeSearch,
        page: 0,
        size: 20,
      }),
    enabled: Boolean(plan.data),
    placeholderData: keepPreviousData,
  });
  const addRecipe = useMutation({
    mutationFn: ({ weekStart, recipeId }: WeeklyPlanRecipeMutation) =>
      api.weeklyPlans.addRecipe(weekStart, recipeId),
    onSuccess: async (updatedPlan, mutation) => {
      queryClient.setQueryData(
        ["weekly-plans", mutation.weekStart],
        updatedPlan,
      );
      await queryClient.invalidateQueries({
        queryKey: ["shopping-lists", mutation.weekStart],
      });
    },
  });
  const removeRecipe = useMutation({
    mutationFn: ({ weekStart, recipeId }: WeeklyPlanRecipeMutation) =>
      api.weeklyPlans.removeRecipe(weekStart, recipeId),
    onSuccess: async (_response, mutation) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["weekly-plans", mutation.weekStart],
        }),
        queryClient.invalidateQueries({
          queryKey: ["shopping-lists", mutation.weekStart],
        }),
      ]);
    },
  });
  const updateQuantity = useMutation({
    mutationFn: ({
      weekStart,
      recipeId,
      quantity,
    }: WeeklyPlanQuantityMutation) =>
      api.weeklyPlans.updateRecipeQuantity(weekStart, recipeId, quantity),
    onMutate: () => setQuantityStatus(null),
    onSuccess: async (updatedPlan, mutation) => {
      queryClient.setQueryData(
        ["weekly-plans", mutation.weekStart],
        updatedPlan,
      );
      await queryClient.invalidateQueries({
        queryKey: ["shopping-lists", mutation.weekStart],
      });
      const updatedRecipe = updatedPlan.recipes.find(
        (recipe) => recipe.id === mutation.recipeId,
      );
      setQuantityStatus(
        updatedRecipe
          ? `Quantidade de ${updatedRecipe.name} atualizada.`
          : "Quantidade atualizada.",
      );
    },
  });
  const plannedIds = useMemo(
    () => new Set(plan.data?.recipes.map((recipe) => recipe.id) ?? []),
    [plan.data],
  );
  const mutationPending =
    addRecipe.isPending || removeRecipe.isPending || updateQuantity.isPending;

  return (
    <section className="page" aria-labelledby="week-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h1 id="week-title">Minha semana</h1>
          <p className="date-range">{weekLabel(weekStart)}</p>
        </div>
      </div>

      <nav className="week-navigation" aria-label="Navegação entre semanas">
        <button
          className="text-button"
          type="button"
          aria-label="Semana anterior"
          onClick={() => navigate(`/semana/${shiftWeek(weekStart, -7)}`)}
        >
          ← Semana anterior
        </button>
        <button
          className="text-button"
          type="button"
          aria-label="Próxima semana"
          onClick={() => navigate(`/semana/${shiftWeek(weekStart, 7)}`)}
        >
          Próxima semana →
        </button>
      </nav>

      <button
        className="text-button"
        type="button"
        onClick={() => navigate(`/compras/${weekStart}`)}
      >
        Ver lista de compras desta semana
      </button>

      {plan.isLoading && (
        <p className="status-message">Carregando planejamento…</p>
      )}

      {plan.isError && (
        <div className="form-alert" role="alert">
          Não foi possível carregar o planejamento desta semana.
        </div>
      )}

      {plan.data && plan.data.recipes.length === 0 && (
        <div className="empty-state empty-state--primary">
          <div className="empty-illustration" aria-hidden="true">
            <span className="plate" />
            <span className="fork">|||</span>
          </div>
          <div>
            <h2>Nenhuma receita planejada</h2>
            <p>
              Escolha os pratos da semana para reunir tudo o que será preparado.
            </p>
          </div>
        </div>
      )}

      {plan.data && plan.data.recipes.length > 0 && (
        <div className="card-list" aria-label="Receitas planejadas">
          {plan.data.recipes.map((recipe) => (
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
                <div className="weekly-plan-quantity">
                  <label htmlFor={`planned-quantity-${recipe.id}`}>
                    Quantidade de {recipe.name}
                  </label>
                  <input
                    id={`planned-quantity-${recipe.id}`}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={
                      plannedQuantities[recipe.id] ??
                      String(recipe.plannedQuantity)
                    }
                    aria-invalid={
                      !isValidQuantity(plannedQuantities[recipe.id])
                    }
                    aria-describedby={
                      !isValidQuantity(plannedQuantities[recipe.id])
                        ? `planned-quantity-error-${recipe.id}`
                        : undefined
                    }
                    disabled={mutationPending}
                    onChange={(event) => {
                      setQuantityStatus(null);
                      setPlannedQuantities((current) => ({
                        ...current,
                        [recipe.id]: event.target.value,
                      }));
                    }}
                  />
                  {!isValidQuantity(plannedQuantities[recipe.id]) && (
                    <span
                      className="field-error"
                      id={`planned-quantity-error-${recipe.id}`}
                    >
                      Informe um número inteiro entre 1 e 100.
                    </span>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Atualizar quantidade de ${recipe.name}`}
                    disabled={
                      mutationPending ||
                      !isValidQuantity(plannedQuantities[recipe.id])
                    }
                    onClick={() =>
                      updateQuantity.mutate({
                        weekStart,
                        recipeId: recipe.id,
                        quantity: Number(plannedQuantities[recipe.id]),
                      })
                    }
                  >
                    Atualizar quantidade
                  </button>
                </div>
              </div>
              <div className="card-actions">
                <button
                  className="text-button text-button--danger"
                  type="button"
                  aria-label={`Remover ${recipe.name}`}
                  disabled={mutationPending}
                  onClick={() =>
                    removeRecipe.mutate({ weekStart, recipeId: recipe.id })
                  }
                >
                  Remover da semana
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(addRecipe.isError ||
        removeRecipe.isError ||
        updateQuantity.isError) && (
        <div className="form-alert" role="alert">
          {mutationError(
            addRecipe.error ?? removeRecipe.error ?? updateQuantity.error,
          )}
        </div>
      )}

      {quantityStatus && (
        <p className="status-message" role="status">
          {quantityStatus}
        </p>
      )}

      {plan.data && (
        <section
          className="editor-card weekly-plan-chooser"
          aria-labelledby="recipe-chooser-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Acervo</p>
            <h2 id="recipe-chooser-title">Adicionar receitas à semana</h2>
          </div>
          <div className="catalog-toolbar">
            <label htmlFor="weekly-plan-recipe-search">Buscar receitas</label>
            <input
              id="weekly-plan-recipe-search"
              type="search"
              value={recipeSearch}
              onChange={(event) => setRecipeSearch(event.target.value)}
              placeholder="Digite parte do nome"
            />
          </div>
          {availableRecipes.isLoading && <p>Carregando receitas…</p>}
          {availableRecipes.isError && (
            <div className="form-alert" role="alert">
              Não foi possível buscar receitas.
            </div>
          )}
          {availableRecipes.data &&
            availableRecipes.data.content.length === 0 && (
              <p>Nenhuma receita encontrada.</p>
            )}
          {availableRecipes.data &&
            availableRecipes.data.content.length > 0 && (
              <div className="recipe-choice-list">
                {availableRecipes.data.content.map((recipe) => {
                  const planned = plannedIds.has(recipe.id);
                  return (
                    <div className="recipe-choice" key={recipe.id}>
                      <div>
                        <strong>{recipe.name}</strong>
                        <small>{recipe.preparationTimeMinutes} min</small>
                      </div>
                      <button
                        className="text-button"
                        type="button"
                        aria-label={
                          planned
                            ? `${recipe.name} já planejada`
                            : `Adicionar ${recipe.name}`
                        }
                        disabled={planned || mutationPending}
                        onClick={() =>
                          addRecipe.mutate({ weekStart, recipeId: recipe.id })
                        }
                      >
                        {planned ? "Já planejada" : "Adicionar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
      )}
    </section>
  );
}

function mutationError(error: Error | null) {
  return error instanceof ApiClientError
    ? error.message
    : "Não foi possível atualizar o planejamento.";
}

function isValidQuantity(value: string | undefined) {
  if (!value) return false;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
}
