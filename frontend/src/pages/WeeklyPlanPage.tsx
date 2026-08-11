import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClientError, api } from "../api/client";

interface WeeklyPlanRecipeMutation {
  weekStart: string;
  recipeId: number;
}

function currentWeekStart() {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  return toIsoDate(monday);
}

function weekLabel(weekStart: string) {
  const monday = new Date(`${weekStart}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${format.format(monday)} — ${format.format(sunday)}`;
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
  const [chooserOpen, setChooserOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
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
    enabled: chooserOpen,
    placeholderData: keepPreviousData,
  });
  const addRecipe = useMutation({
    mutationFn: ({ weekStart, recipeId }: WeeklyPlanRecipeMutation) =>
      api.weeklyPlans.addRecipe(weekStart, recipeId),
    onSuccess: (updatedPlan, mutation) => {
      queryClient.setQueryData(
        ["weekly-plans", mutation.weekStart],
        updatedPlan,
      );
    },
  });
  const removeRecipe = useMutation({
    mutationFn: ({ weekStart, recipeId }: WeeklyPlanRecipeMutation) =>
      api.weeklyPlans.removeRecipe(weekStart, recipeId),
    onSuccess: async (_response, mutation) => {
      await queryClient.invalidateQueries({
        queryKey: ["weekly-plans", mutation.weekStart],
      });
    },
  });
  const plannedIds = useMemo(
    () => new Set(plan.data?.recipes.map((recipe) => recipe.id) ?? []),
    [plan.data],
  );
  const mutationPending = addRecipe.isPending || removeRecipe.isPending;

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
          <button
            className="primary-button"
            type="button"
            onClick={() => setChooserOpen(true)}
          >
            Escolher receitas
            <span aria-hidden="true">→</span>
          </button>
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

      {plan.data && plan.data.recipes.length > 0 && !chooserOpen && (
        <button
          className="primary-button weekly-plan-add-button"
          type="button"
          onClick={() => setChooserOpen(true)}
        >
          Escolher receitas
        </button>
      )}

      {(addRecipe.isError || removeRecipe.isError) && (
        <div className="form-alert" role="alert">
          {mutationError(addRecipe.error ?? removeRecipe.error)}
        </div>
      )}

      {chooserOpen && (
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
          <div className="form-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={mutationPending}
              onClick={() => setChooserOpen(false)}
            >
              Fechar
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidWeekStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    toIsoDate(date) === value &&
    date.getDay() === 1
  );
}

function shiftWeek(weekStart: string, days: number) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function mutationError(error: Error | null) {
  return error instanceof ApiClientError
    ? error.message
    : "Não foi possível atualizar o planejamento.";
}
