import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { MeasurementUnit } from "../api/types";
import {
  currentWeekStart,
  isValidWeekStart,
  shiftWeek,
  weekLabel,
} from "../features/weekly-plan/week";

const unitLabels: Record<MeasurementUnit, string> = {
  GRAM: "g",
  KILOGRAM: "kg",
  MILLILITER: "ml",
  LITER: "L",
  UNIT: "un.",
  TABLESPOON: "colher(es) de sopa",
  TEASPOON: "colher(es) de chá",
  CUP: "xícara(s)",
  PINCH: "pitada(s)",
};

export function ShoppingListPage() {
  const navigate = useNavigate();
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
      navigate(`/compras/${weekStart}`, { replace: true });
    }
  }, [navigate, routeWeekStart, weekStart]);

  const shoppingList = useQuery({
    queryKey: ["shopping-lists", weekStart],
    queryFn: () => api.weeklyPlans.getShoppingList(weekStart),
  });

  return (
    <section className="page" aria-labelledby="shopping-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Mercado</p>
          <h1 id="shopping-title">Lista de compras</h1>
          <p className="date-range">{weekLabel(weekStart)}</p>
          <p className="page-description">
            Ingredientes consolidados a partir das receitas planejadas para a
            semana.
          </p>
        </div>
      </div>

      <nav className="week-navigation" aria-label="Navegação entre semanas">
        <button
          className="text-button"
          type="button"
          aria-label="Semana anterior"
          onClick={() => navigate(`/compras/${shiftWeek(weekStart, -7)}`)}
        >
          ← Semana anterior
        </button>
        <button
          className="text-button"
          type="button"
          aria-label="Próxima semana"
          onClick={() => navigate(`/compras/${shiftWeek(weekStart, 7)}`)}
        >
          Próxima semana →
        </button>
      </nav>

      <button
        className="text-button"
        type="button"
        onClick={() => navigate(`/semana/${weekStart}`)}
      >
        Voltar ao planejamento desta semana
      </button>

      {shoppingList.isLoading && (
        <p className="status-message">Carregando lista de compras…</p>
      )}

      {shoppingList.isError && (
        <div className="form-alert" role="alert">
          Não foi possível carregar a lista de compras desta semana.
        </div>
      )}

      {shoppingList.data && shoppingList.data.items.length === 0 && (
        <div className="empty-state">
          <span className="line-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2>Nada para comprar ainda</h2>
            <p>Adicione receitas ao planejamento semanal para gerar a lista.</p>
          </div>
        </div>
      )}

      {shoppingList.data && shoppingList.data.items.length > 0 && (
        <div className="card-list" aria-label="Ingredientes para comprar">
          {shoppingList.data.items.map((item) => (
            <article
              className="catalog-card"
              key={`${item.ingredientId}-${item.unit}`}
            >
              <div className="catalog-card__body">
                <div className="catalog-card__title">
                  <h2>{item.ingredientName}</h2>
                </div>
                <p className="shopping-list-quantity">
                  {formatQuantity(item.quantity)} {unitLabels[item.unit]}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(quantity);
}
