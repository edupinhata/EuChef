import type {
  ApiErrorBody,
  AuthenticatedUser,
  CsrfToken,
  Ingredient,
  IngredientPayload,
  LoginPayload,
  PagedResponse,
  PageQuery,
  Recipe,
  RecipePayload,
  RecipeSummary,
  RegistrationPayload,
} from "./types";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors: Record<string, string>;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code = "REQUEST_ERROR",
    fieldErrors: Record<string, string> = {},
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

let csrfTokenPromise: Promise<CsrfToken> | undefined;

async function parseResponse<T>(response: Response): Promise<T> {
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
      error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function getCsrfToken(): Promise<CsrfToken> {
  csrfTokenPromise ??= fetch("/api/v1/auth/csrf", {
    credentials: "same-origin",
  }).then(parseResponse<CsrfToken>);

  try {
    return await csrfTokenPromise;
  } catch (error) {
    csrfTokenPromise = undefined;
    throw error;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryInvalidCsrf = true,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const mutatesState = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init.headers);

  if (init.body) headers.set("Content-Type", "application/json");
  if (mutatesState) {
    const csrf = await getCsrfToken();
    headers.set(csrf.headerName, csrf.token);
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  if (mutatesState && retryInvalidCsrf && response.status === 403) {
    try {
      const error = (await response.clone().json()) as ApiErrorBody;
      if (error.code === "INVALID_CSRF_TOKEN") {
        csrfTokenPromise = undefined;
        return request<T>(path, init, false);
      }
    } catch {
      // A resposta original será tratada abaixo com uma mensagem segura.
    }
  }
  return parseResponse<T>(response);
}

function pagePath(path: string, query: PageQuery) {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.page !== undefined) search.set("page", String(query.page));
  if (query.size !== undefined) search.set("size", String(query.size));
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function resource<T, P, L = T>(path: string) {
  return {
    list: (query: PageQuery = {}) =>
      request<PagedResponse<L>>(pagePath(path, query)),
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
  auth: {
    me: () => request<AuthenticatedUser>("/api/v1/auth/me"),
    login: (payload: LoginPayload) =>
      request<AuthenticatedUser>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    register: (payload: RegistrationPayload) =>
      request<AuthenticatedUser>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: async () => {
      await request<void>("/api/v1/auth/logout", { method: "POST" });
      csrfTokenPromise = undefined;
    },
  },
  ingredients: resource<Ingredient, IngredientPayload>("/api/v1/ingredients"),
  recipes: resource<Recipe, RecipePayload, RecipeSummary>("/api/v1/recipes"),
};

export function resetApiSecurityStateForTests() {
  csrfTokenPromise = undefined;
}
