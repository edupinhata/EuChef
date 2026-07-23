export type MeasurementUnit =
  | "GRAM"
  | "KILOGRAM"
  | "MILLILITER"
  | "LITER"
  | "UNIT"
  | "TABLESPOON"
  | "TEASPOON"
  | "CUP"
  | "PINCH";

export interface NutritionFacts {
  caloriesKcal?: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sodiumMilligrams?: number;
}

export interface Seasonality {
  startMonth: number;
  endMonth: number;
}

export interface IngredientPayload {
  name: string;
  description?: string;
  defaultUnit: MeasurementUnit;
  nutritionPer100g?: NutritionFacts;
  seasonality?: Seasonality;
}

export interface Ingredient extends IngredientPayload {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageQuery {
  q?: string;
  page?: number;
  size?: number;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface RecipeIngredientPayload {
  ingredientId: number;
  quantity: number;
  unit: MeasurementUnit;
  notes?: string;
}

export interface RecipePayload {
  name: string;
  description?: string;
  servings: number;
  preparationTimeMinutes: number;
  ingredients: RecipeIngredientPayload[];
  preparationSteps: string[];
}

export interface RecipeIngredient extends RecipeIngredientPayload {
  ingredientName: string;
}

export interface RecipeStep {
  position: number;
  instruction: string;
}

export interface Recipe extends Omit<
  RecipePayload,
  "ingredients" | "preparationSteps"
> {
  id: number;
  ingredients: RecipeIngredient[];
  preparationSteps: RecipeStep[];
  createdAt: string;
  updatedAt: string;
}

export type RecipeSummary = Omit<Recipe, "ingredients" | "preparationSteps">;

export interface AuthenticatedUser {
  id: number;
  displayName: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegistrationPayload extends LoginPayload {
  displayName: string;
}

export interface CsrfToken {
  token: string;
  headerName: string;
  parameterName: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;
}
