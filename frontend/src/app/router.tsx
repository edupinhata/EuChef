import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PantryPage } from "../pages/PantryPage";
import { RecipesPage } from "../pages/RecipesPage";
import { ShoppingListPage } from "../pages/ShoppingListPage";
import { WeeklyPlanPage } from "../pages/WeeklyPlanPage";
import { IngredientsPage } from "../pages/IngredientsPage";
import { LoginPage } from "../pages/LoginPage";
import { RequireAuthentication } from "./RequireAuthentication";
import { useAuth } from "./useAuth";

function AuthenticatedRecipesPage() {
  const { user } = useAuth();
  return user ? <RecipesPage user={user} /> : null;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route element={<RequireAuthentication />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/semana/atual" replace />} />
          <Route path="/semana/:weekStart" element={<WeeklyPlanPage />} />
          <Route path="/receitas" element={<AuthenticatedRecipesPage />} />
          <Route path="/ingredientes" element={<IngredientsPage />} />
          <Route path="/compras/:weekStart" element={<ShoppingListPage />} />
          <Route path="/despensa" element={<PantryPage />} />
          <Route path="*" element={<Navigate to="/semana/atual" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
