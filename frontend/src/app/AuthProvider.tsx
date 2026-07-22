import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../api/client";
import type { AuthenticatedUser } from "../api/types";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof ApiClientError && error.status === 401)
        ) {
          console.error("Falha ao restaurar a sessão", error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (payload) => {
        setUser(await api.auth.login(payload));
      },
      register: async (payload) => {
        await api.auth.register(payload);
        setUser(
          await api.auth.login({
            email: payload.email,
            password: payload.password,
          }),
        );
      },
      logout: async () => {
        await api.auth.logout();
        setUser(null);
        queryClient.clear();
      },
    }),
    [loading, queryClient, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
