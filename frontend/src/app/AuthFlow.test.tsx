import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { resetApiSecurityStateForTests } from "../api/client";

const authenticatedUser = {
  id: 1,
  displayName: "Ana Souza",
  email: "ana@example.com",
  role: "USER",
};

afterEach(() => {
  vi.restoreAllMocks();
  resetApiSecurityStateForTests();
  window.history.replaceState({}, "", "/");
});

describe("fluxo de autenticação", () => {
  it("redireciona anônimo e entra usando sessão e CSRF", async () => {
    window.history.replaceState({}, "", "/semana/atual");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: "AUTHENTICATION_REQUIRED",
          message: "Autenticação obrigatória",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "csrf-token",
          headerName: "X-CSRF-TOKEN",
          parameterName: "_csrf",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => authenticatedUser,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ weekStart: "2026-07-27", recipes: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      } as Response);

    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /entrar/i }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/e-mail/i), "ana@example.com");
    await user.type(screen.getByLabelText(/senha/i), "senha-segura-123");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(
      await screen.findByRole("heading", { name: /minha semana/i }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/v1/auth/login");
    expect(String(fetchMock.mock.calls[3]?.[0])).toMatch(
      /^\/api\/v1\/weekly-plans\/\d{4}-\d{2}-\d{2}$/,
    );
    expect(String(fetchMock.mock.calls[4]?.[0])).toMatch(
      /^\/api\/v1\/recipes\?/,
    );
    const loginInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(loginInit.credentials).toBe("same-origin");
    expect(new Headers(loginInit.headers).get("X-CSRF-TOKEN")).toBe(
      "csrf-token",
    );
  });
});
