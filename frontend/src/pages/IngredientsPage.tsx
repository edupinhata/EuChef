import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiClientError, api } from "../api/client";
import type { Ingredient, IngredientPayload } from "../api/types";
import { IngredientForm } from "../features/ingredients/IngredientForm";
import { measurementUnits } from "../features/ingredients/measurementUnits";

const monthNames = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function IngredientsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient>();
  const ingredients = useQuery({
    queryKey: ["ingredients"],
    queryFn: api.ingredients.list,
  });
  const save = useMutation({
    mutationFn: (payload: IngredientPayload) =>
      editing
        ? api.ingredients.update(editing.id, payload)
        : api.ingredients.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      closeForm();
    },
  });
  const remove = useMutation({
    mutationFn: api.ingredients.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
  });

  function closeForm() {
    setFormOpen(false);
    setEditing(undefined);
    save.reset();
  }

  function edit(ingredient: Ingredient) {
    setEditing(ingredient);
    setFormOpen(true);
    save.reset();
  }

  function deleteIngredient(ingredient: Ingredient) {
    if (
      window.confirm(
        `Excluir “${ingredient.name}”? Receitas que utilizam o ingrediente impedirão a exclusão.`,
      )
    ) {
      remove.mutate(ingredient.id);
    }
  }

  return (
    <section className="page" aria-labelledby="ingredients-title">
      <div className="page-heading page-heading--stacked">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 id="ingredients-title">Ingredientes</h1>
          <p className="page-description">
            Cadastre unidades, valores nutricionais por 100 g e períodos de
            safra.
          </p>
        </div>
        {!formOpen && (
          <button
            className="primary-button compact-button"
            type="button"
            onClick={() => setFormOpen(true)}
          >
            <span aria-hidden="true">＋</span> Novo ingrediente
          </button>
        )}
      </div>

      {formOpen && (
        <section
          className="editor-card"
          aria-labelledby="ingredient-form-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editing ? "Edição" : "Novo cadastro"}</p>
              <h2 id="ingredient-form-title">
                {editing ? editing.name : "Adicionar ingrediente"}
              </h2>
            </div>
          </div>
          <IngredientForm
            key={editing?.id ?? "new"}
            initialData={editing}
            onSubmit={async (payload) => {
              await save.mutateAsync(payload);
            }}
            onCancel={closeForm}
            pending={save.isPending}
            error={errorMessage(save.error)}
          />
        </section>
      )}

      {remove.error && (
        <div className="form-alert" role="alert">
          {errorMessage(remove.error)}
        </div>
      )}

      {ingredients.isLoading && (
        <p className="status-message">Carregando ingredientes…</p>
      )}
      {ingredients.isError && (
        <div className="form-alert" role="alert">
          Não foi possível carregar os ingredientes. Confirme se o backend está
          em execução.
        </div>
      )}
      {ingredients.data?.length === 0 && !formOpen && (
        <div className="empty-state">
          <span className="line-icon" aria-hidden="true">
            ◌
          </span>
          <div>
            <h2>Nenhum ingrediente cadastrado</h2>
            <p>
              Comece pelos itens que aparecem com frequência nas suas receitas.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => setFormOpen(true)}
          >
            Adicionar primeiro ingrediente
          </button>
        </div>
      )}

      {ingredients.data && ingredients.data.length > 0 && (
        <div className="card-list" aria-label="Ingredientes cadastrados">
          {ingredients.data.map((ingredient) => (
            <article className="catalog-card" key={ingredient.id}>
              <div className="catalog-card__body">
                <div className="catalog-card__title">
                  <h2>{ingredient.name}</h2>
                  <span className="unit-chip">
                    {unitLabel(ingredient.defaultUnit)}
                  </span>
                </div>
                {ingredient.description && <p>{ingredient.description}</p>}
                <div className="metadata-row">
                  {ingredient.nutritionPer100g && (
                    <span>
                      <strong>
                        {ingredient.nutritionPer100g.caloriesKcal ?? "—"}
                      </strong>{" "}
                      kcal / 100 g
                    </span>
                  )}
                  {ingredient.seasonality && (
                    <span className="season-chip">
                      Época: {monthNames[ingredient.seasonality.startMonth - 1]}
                      –{monthNames[ingredient.seasonality.endMonth - 1]}
                    </span>
                  )}
                </div>
              </div>
              <div className="card-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => edit(ingredient)}
                >
                  Editar
                </button>
                <button
                  className="text-button text-button--danger"
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => deleteIngredient(ingredient)}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function unitLabel(value: Ingredient["defaultUnit"]) {
  return measurementUnits.find((unit) => unit.value === value)?.label ?? value;
}

function errorMessage(error: Error | null) {
  return error instanceof ApiClientError ? error.message : error?.message;
}
