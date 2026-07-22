import { afterEach, describe, expect, it, vi } from "vitest";
import { api, resetApiSecurityStateForTests } from "./client";

const ingredient = {
  id: 1,
  name: "Morango",
  description: "Fruta fresca",
  defaultUnit: "GRAM" as const,
  nutritionPer100g: {
    caloriesKcal: 32,
    proteinGrams: 0.7,
    carbohydrateGrams: 7.7,
    fatGrams: 0.3,
    fiberGrams: 2,
    sodiumMilligrams: 1,
  },
  seasonality: { startMonth: 6, endMonth: 11 },
  createdAt: "2026-07-21T12:00:00Z",
  updatedAt: "2026-07-21T12:00:00Z",
};

const csrfResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    token: "csrf-token",
    headerName: "X-CSRF-TOKEN",
    parameterName: "_csrf",
  }),
} as Response;

afterEach(() => {
  vi.restoreAllMocks();
  resetApiSecurityStateForTests();
});

describe("api client", () => {
  it("sends session, CSRF and a complete ingredient", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(csrfResponse)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ingredient,
      } as Response);

    const payload = {
      name: ingredient.name,
      description: ingredient.description,
      defaultUnit: ingredient.defaultUnit,
      nutritionPer100g: ingredient.nutritionPer100g,
      seasonality: ingredient.seasonality,
    };
    await expect(api.ingredients.create(payload)).resolves.toEqual(ingredient);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/ingredients");
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify(payload),
      }),
    );
    const headers = new Headers(request.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-TOKEN")).toBe("csrf-token");
  });

  it("exposes the structured API error", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(csrfResponse)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "DUPLICATE_RESOURCE",
          message: "Já existe um ingrediente com este nome",
          fieldErrors: {},
        }),
      } as Response);

    await expect(
      api.ingredients.create({ name: "Morango", defaultUnit: "GRAM" }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Já existe um ingrediente com este nome",
        status: 409,
      }),
    );
  });

  it("renews an invalid CSRF token and retries only once", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(csrfResponse)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "INVALID_CSRF_TOKEN",
            message: "Token CSRF ausente ou inválido",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "renewed-csrf-token",
          headerName: "X-CSRF-TOKEN",
          parameterName: "_csrf",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ingredient,
      } as Response);

    await expect(
      api.ingredients.create({ name: "Morango", defaultUnit: "GRAM" }),
    ).resolves.toEqual(ingredient);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retriedRequest = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(retriedRequest.headers).get("X-CSRF-TOKEN")).toBe(
      "renewed-csrf-token",
    );
  });

  it("does not retry an authorization denial", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(csrfResponse)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "ACCESS_DENIED",
            message: "Acesso não autorizado",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(
      api.ingredients.create({ name: "Morango", defaultUnit: "GRAM" }),
    ).rejects.toEqual(
      expect.objectContaining({ code: "ACCESS_DENIED", status: 403 }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
