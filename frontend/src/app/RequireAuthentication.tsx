import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function RequireAuthentication() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-page" aria-live="polite">
        <p>Verificando sessão…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
