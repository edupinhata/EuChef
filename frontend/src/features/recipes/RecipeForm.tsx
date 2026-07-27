import { useFieldArray, useForm } from "react-hook-form";
import { cloneElement, type ReactElement } from "react";
import type {
  Ingredient,
  MeasurementUnit,
  Recipe,
  RecipePayload,
} from "../../api/types";
import { measurementUnits } from "../ingredients/measurementUnits";

interface RecipeFormProps {
  ingredients: Ingredient[];
  ingredientSearch?: string;
  onIngredientSearch?: (value: string) => void;
  initialData?: Recipe;
  onSubmit: (payload: RecipePayload) => void | Promise<void>;
  onCancel?: () => void;
  pending?: boolean;
  error?: string;
}

interface IngredientValues {
  ingredientId: number;
  quantity: number;
  unit: MeasurementUnit;
  notes: string;
}

interface StepValues {
  instruction: string;
}

interface FormValues {
  name: string;
  description: string;
  servings: number;
  preparationTimeMinutes: number;
  ingredients: IngredientValues[];
  preparationSteps: StepValues[];
}

const emptyIngredient: IngredientValues = {
  ingredientId: undefined as unknown as number,
  quantity: 1,
  unit: "GRAM",
  notes: "",
};

function hasAtMostThreeDecimalPlaces(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 4;
  return Math.abs(value - rounded) <= tolerance;
}

function formDefaults(recipe?: Recipe): FormValues {
  if (!recipe) {
    return {
      name: "",
      description: "",
      servings: 1,
      preparationTimeMinutes: 0,
      ingredients: [{ ...emptyIngredient }],
      preparationSteps: [{ instruction: "" }],
    };
  }
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    servings: recipe.servings,
    preparationTimeMinutes: recipe.preparationTimeMinutes,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ingredientId: ingredient.ingredientId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      notes: ingredient.notes ?? "",
    })),
    preparationSteps: [...recipe.preparationSteps]
      .sort((left, right) => left.position - right.position)
      .map((step) => ({ instruction: step.instruction })),
  };
}

export function RecipeForm({
  ingredients,
  ingredientSearch = "",
  onIngredientSearch,
  initialData,
  onSubmit,
  onCancel,
  pending = false,
  error,
}: RecipeFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: formDefaults(initialData),
  });
  const ingredientFields = useFieldArray({ control, name: "ingredients" });
  const stepFields = useFieldArray({ control, name: "preparationSteps" });

  const ingredientChoices = new Map<number, string>(
    ingredients.map((ingredient) => [ingredient.id, ingredient.name]),
  );
  for (const ingredient of initialData?.ingredients ?? []) {
    ingredientChoices.set(ingredient.ingredientId, ingredient.ingredientName);
  }

  const submit = handleSubmit(async (values) => {
    const seenIngredientIds = new Set<number>();
    for (let index = 0; index < values.ingredients.length; index += 1) {
      const ingredientId = values.ingredients[index].ingredientId;
      if (seenIngredientIds.has(ingredientId)) {
        setError(`ingredients.${index}.ingredientId`, {
          message: "Este ingrediente já foi adicionado.",
        });
        return;
      }
      seenIngredientIds.add(ingredientId);
    }

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      servings: values.servings,
      preparationTimeMinutes: values.preparationTimeMinutes,
      ingredients: values.ingredients.map((ingredient) => ({
        ingredientId: ingredient.ingredientId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes.trim() || undefined,
      })),
      preparationSteps: values.preparationSteps.map((step) =>
        step.instruction.trim(),
      ),
    });
  });

  return (
    <form className="data-form" onSubmit={submit} noValidate>
      <FormField label="Nome" error={errors.name?.message} wide>
        <input
          id="recipe-name"
          autoFocus
          maxLength={160}
          {...register("name", {
            required: "Informe o nome da receita.",
            validate: (value) =>
              value.trim().length >= 2 || "Use pelo menos 2 caracteres.",
          })}
        />
      </FormField>

      <FormField label="Descrição (opcional)" wide>
        <textarea
          id="recipe-description"
          rows={3}
          maxLength={1500}
          {...register("description")}
        />
      </FormField>

      <FormField label="Porções" error={errors.servings?.message}>
        <input
          id="recipe-servings"
          type="number"
          min="1"
          max="1000"
          {...register("servings", {
            valueAsNumber: true,
            validate: (value) =>
              (Number.isInteger(value) && value >= 1 && value <= 1000) ||
              "Informe um número inteiro entre 1 e 1000.",
          })}
        />
      </FormField>

      <FormField
        label="Tempo de preparo (minutos)"
        error={errors.preparationTimeMinutes?.message}
      >
        <input
          id="recipe-preparation-time"
          type="number"
          min="0"
          max="10080"
          {...register("preparationTimeMinutes", {
            valueAsNumber: true,
            validate: (value) =>
              (Number.isInteger(value) && value >= 0 && value <= 10080) ||
              "Informe minutos inteiros entre 0 e 10080.",
          })}
        />
      </FormField>

      <fieldset className="form-section form-field--wide">
        <legend>Ingredientes</legend>
        {onIngredientSearch && (
          <div className="form-field form-field--wide">
            <label htmlFor="recipe-ingredient-search">
              Buscar ingredientes para a receita
            </label>
            <input
              id="recipe-ingredient-search"
              type="search"
              maxLength={100}
              value={ingredientSearch}
              placeholder="Digite parte do nome"
              onChange={(event) => onIngredientSearch(event.target.value)}
            />
          </div>
        )}
        {ingredientFields.fields.map((field, index) => (
          <div className="form-grid" key={field.id}>
            <FormField
              label={`Ingrediente ${index + 1}`}
              error={errors.ingredients?.[index]?.ingredientId?.message}
              wide
            >
              <select
                id={`recipe-ingredient-${index}`}
                {...register(`ingredients.${index}.ingredientId`, {
                  valueAsNumber: true,
                  validate: (value) =>
                    (Number.isInteger(value) && value > 0) ||
                    "Selecione um ingrediente.",
                })}
              >
                <option value="">Selecione um ingrediente</option>
                {Array.from(ingredientChoices.entries()).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={`Quantidade ${index + 1}`}
              error={errors.ingredients?.[index]?.quantity?.message}
            >
              <input
                id={`recipe-quantity-${index}`}
                type="number"
                min="0.001"
                max="999999999.999"
                step="0.001"
                {...register(`ingredients.${index}.quantity`, {
                  valueAsNumber: true,
                  validate: (value) =>
                    (Number.isFinite(value) &&
                      value >= 0.001 &&
                      value <= 999999999.999 &&
                      hasAtMostThreeDecimalPlaces(value)) ||
                    "Use uma quantidade válida com até três casas decimais.",
                })}
              />
            </FormField>
            <FormField label={`Unidade ${index + 1}`}>
              <select
                id={`recipe-unit-${index}`}
                {...register(`ingredients.${index}.unit`)}
              >
                {measurementUnits.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={`Observações ${index + 1} (opcional)`} wide>
              <input
                id={`recipe-notes-${index}`}
                maxLength={500}
                {...register(`ingredients.${index}.notes`)}
              />
            </FormField>
            {ingredientFields.fields.length > 1 && (
              <button
                className="text-button text-button--danger"
                type="button"
                onClick={() => ingredientFields.remove(index)}
              >
                Remover ingrediente {index + 1}
              </button>
            )}
          </div>
        ))}
        <button
          className="text-button"
          type="button"
          disabled={ingredientFields.fields.length >= 100}
          onClick={() => ingredientFields.append({ ...emptyIngredient })}
        >
          Adicionar ingrediente
        </button>
      </fieldset>

      <fieldset className="form-section form-field--wide">
        <legend>Modo de preparo</legend>
        {stepFields.fields.map((field, index) => (
          <div className="form-field form-field--wide" key={field.id}>
            <label htmlFor={`recipe-step-${index}`}>Passo {index + 1}</label>
            <textarea
              id={`recipe-step-${index}`}
              rows={3}
              maxLength={2000}
              {...register(`preparationSteps.${index}.instruction`, {
                validate: (value) =>
                  value.trim().length > 0 || "Descreva este passo.",
              })}
            />
            {errors.preparationSteps?.[index]?.instruction && (
              <span className="field-error">
                {errors.preparationSteps[index].instruction.message}
              </span>
            )}
            <div className="card-actions">
              <button
                className="text-button"
                type="button"
                disabled={index === 0}
                onClick={() => stepFields.move(index, index - 1)}
              >
                Mover passo {index + 1} para cima
              </button>
              <button
                className="text-button"
                type="button"
                disabled={index === stepFields.fields.length - 1}
                onClick={() => stepFields.move(index, index + 1)}
              >
                Mover passo {index + 1} para baixo
              </button>
              {stepFields.fields.length > 1 && (
                <button
                  className="text-button text-button--danger"
                  type="button"
                  onClick={() => stepFields.remove(index)}
                >
                  Remover passo {index + 1}
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          className="text-button"
          type="button"
          disabled={stepFields.fields.length >= 100}
          onClick={() => stepFields.append({ instruction: "" })}
        >
          Adicionar passo
        </button>
      </fieldset>

      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions form-field--wide">
        {onCancel && (
          <button
            className="text-button"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar receita"}
        </button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const id = children.props.id;
  const errorId = id && error ? `${id}-error` : undefined;
  const control = cloneElement(children, {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": errorId,
  });
  return (
    <div className={`form-field${wide ? " form-field--wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
