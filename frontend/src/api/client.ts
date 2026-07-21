import type {
  ApiErrorBody,
  Ingredient,
  IngredientPayload,
  Recipe,
  RecipePayload,
} from "./types";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code = "REQUEST_ERROR",
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json" }
      : init?.headers,
  });

  if (!response.ok) {
    let error: ApiErrorBody = {
      code: "REQUEST_ERROR",
      message: "Não foi possível concluir a operação.",
    };
    try {
      error = (await response.json()) as ApiErrorBody;
    } catch {
      // Mantém a mensagem segura quando a resposta não é JSON.
    }
    throw new ApiClientError(
      error.message,
      response.status,
      error.code,
      error.fieldErrors,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function resource<T, P>(path: string) {
  return {
    list: () => request<T[]>(path),
    get: (id: number) => request<T>(`${path}/${id}`),
    create: (payload: P) =>
      request<T>(path, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: P) =>
      request<T>(`${path}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    delete: (id: number) =>
      request<void>(`${path}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  ingredients: resource<Ingredient, IngredientPayload>("/api/v1/ingredients"),
  recipes: resource<Recipe, RecipePayload>("/api/v1/recipes"),
};
