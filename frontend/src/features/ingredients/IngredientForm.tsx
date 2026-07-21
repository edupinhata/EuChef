import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  Ingredient,
  IngredientPayload,
  MeasurementUnit,
  NutritionFacts,
} from "../../api/types";

import { measurementUnits } from "./measurementUnits";

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type NumericField = number | "";

interface FormValues {
  name: string;
  description: string;
  defaultUnit: MeasurementUnit;
  caloriesKcal: NumericField;
  proteinGrams: NumericField;
  carbohydrateGrams: NumericField;
  fatGrams: NumericField;
  fiberGrams: NumericField;
  sodiumMilligrams: NumericField;
  startMonth: number;
  endMonth: number;
}

interface IngredientFormProps {
  initialData?: Ingredient;
  onSubmit: (payload: IngredientPayload) => void | Promise<void>;
  onCancel?: () => void;
  pending?: boolean;
  error?: string;
}

export function IngredientForm({
  initialData,
  onSubmit,
  onCancel,
  pending = false,
  error,
}: IngredientFormProps) {
  const [includeNutrition, setIncludeNutrition] = useState(
    Boolean(initialData?.nutritionPer100g),
  );
  const [includeSeasonality, setIncludeSeasonality] = useState(
    Boolean(initialData?.seasonality),
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      defaultUnit: initialData?.defaultUnit ?? "GRAM",
      caloriesKcal: initialData?.nutritionPer100g?.caloriesKcal ?? "",
      proteinGrams: initialData?.nutritionPer100g?.proteinGrams ?? "",
      carbohydrateGrams: initialData?.nutritionPer100g?.carbohydrateGrams ?? "",
      fatGrams: initialData?.nutritionPer100g?.fatGrams ?? "",
      fiberGrams: initialData?.nutritionPer100g?.fiberGrams ?? "",
      sodiumMilligrams: initialData?.nutritionPer100g?.sodiumMilligrams ?? "",
      startMonth: initialData?.seasonality?.startMonth ?? 1,
      endMonth: initialData?.seasonality?.endMonth ?? 12,
    },
  });

  const submit = handleSubmit(async (values) => {
    const nutrition = includeNutrition
      ? compactNutrition({
          caloriesKcal: values.caloriesKcal,
          proteinGrams: values.proteinGrams,
          carbohydrateGrams: values.carbohydrateGrams,
          fatGrams: values.fatGrams,
          fiberGrams: values.fiberGrams,
          sodiumMilligrams: values.sodiumMilligrams,
        })
      : undefined;
    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      defaultUnit: values.defaultUnit,
      nutritionPer100g: nutrition,
      seasonality: includeSeasonality
        ? {
            startMonth: Number(values.startMonth),
            endMonth: Number(values.endMonth),
          }
        : undefined,
    });
  });

  return (
    <form className="data-form" onSubmit={submit} noValidate>
      <div className="form-field form-field--wide">
        <label htmlFor="ingredient-name">Nome</label>
        <input
          id="ingredient-name"
          autoFocus
          {...register("name", {
            required: "Informe o nome do ingrediente.",
            minLength: { value: 2, message: "Use pelo menos 2 caracteres." },
          })}
        />
        {errors.name && (
          <span className="field-error">{errors.name.message}</span>
        )}
      </div>

      <div className="form-field form-field--wide">
        <label htmlFor="ingredient-description">Descrição (opcional)</label>
        <textarea
          id="ingredient-description"
          rows={3}
          {...register("description")}
        />
      </div>

      <div className="form-field form-field--wide">
        <label htmlFor="ingredient-unit">Unidade padrão</label>
        <select id="ingredient-unit" {...register("defaultUnit")}>
          {measurementUnits.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>

      <label className="option-toggle form-field--wide">
        <input
          type="checkbox"
          aria-label="Adicionar informações nutricionais"
          checked={includeNutrition}
          onChange={(event) => setIncludeNutrition(event.target.checked)}
        />
        <span>
          <strong>Adicionar informações nutricionais</strong>
          <small>Valores opcionais por 100 g do ingrediente.</small>
        </span>
      </label>

      {includeNutrition && (
        <fieldset className="form-section form-field--wide">
          <legend>Informações nutricionais por 100 g</legend>
          <div className="form-grid">
            <NumberField
              label="Calorias (kcal)"
              name="caloriesKcal"
              register={register}
            />
            <NumberField
              label="Proteínas (g)"
              name="proteinGrams"
              register={register}
            />
            <NumberField
              label="Carboidratos (g)"
              name="carbohydrateGrams"
              register={register}
            />
            <NumberField
              label="Gorduras (g)"
              name="fatGrams"
              register={register}
            />
            <NumberField
              label="Fibras (g)"
              name="fiberGrams"
              register={register}
            />
            <NumberField
              label="Sódio (mg)"
              name="sodiumMilligrams"
              register={register}
            />
          </div>
        </fieldset>
      )}

      <label className="option-toggle form-field--wide">
        <input
          type="checkbox"
          aria-label="Ingrediente de época"
          checked={includeSeasonality}
          onChange={(event) => setIncludeSeasonality(event.target.checked)}
        />
        <span>
          <strong>Ingrediente de época</strong>
          <small>O período inclui os meses de entrada e saída.</small>
        </span>
      </label>

      {includeSeasonality && (
        <fieldset className="form-section form-field--wide">
          <legend>Período de safra</legend>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="season-start">Entra em época</label>
              <select
                id="season-start"
                {...register("startMonth", { valueAsNumber: true })}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="season-end">Sai de época</label>
              <select
                id="season-end"
                {...register("endMonth", { valueAsNumber: true })}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions form-field--wide">
        {onCancel && (
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar ingrediente"}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof Pick<
    FormValues,
    | "caloriesKcal"
    | "proteinGrams"
    | "carbohydrateGrams"
    | "fatGrams"
    | "fiberGrams"
    | "sodiumMilligrams"
  >;
  register: ReturnType<typeof useForm<FormValues>>["register"];
}) {
  const id = `nutrition-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        {...register(name, { valueAsNumber: true, min: 0 })}
      />
    </div>
  );
}

function compactNutrition(values: Record<keyof NutritionFacts, NumericField>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    ),
  ) as NutritionFacts;
}
