import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { ShoppingListPage } from "./ShoppingListPage";

afterEach(() => vi.restoreAllMocks());

describe("ShoppingListPage", () => {
  it("shows the consolidated ingredient quantities for the selected week", async () => {
    const getShoppingList = vi
      .spyOn(api.weeklyPlans, "getShoppingList")
      .mockResolvedValue({
        weekStart: "2026-07-27",
        items: [
          {
            ingredientId: 1,
            ingredientName: "Farinha",
            quantity: 376.5,
            unit: "GRAM",
          },
          {
            ingredientId: 2,
            ingredientName: "Ovo",
            quantity: 2,
            unit: "UNIT",
          },
        ],
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/compras/2026-07-27"]}>
          <Routes>
            <Route path="/compras/:weekStart" element={<ShoppingListPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Farinha")).toBeInTheDocument();
    expect(screen.getByText("376,5 g")).toBeInTheDocument();
    expect(screen.getByText("Ovo")).toBeInTheDocument();
    expect(screen.getByText("2 un.")).toBeInTheDocument();
    expect(getShoppingList).toHaveBeenCalledWith("2026-07-27");
  });

  it("explains when the selected week has no ingredients to buy", async () => {
    vi.spyOn(api.weeklyPlans, "getShoppingList").mockResolvedValue({
      weekStart: "2026-07-27",
      items: [],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/compras/2026-07-27"]}>
          <Routes>
            <Route path="/compras/:weekStart" element={<ShoppingListPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Nada para comprar ainda" }),
    ).toBeInTheDocument();
  });
});
