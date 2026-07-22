import { createContext } from "react";
import type {
  AuthenticatedUser,
  LoginPayload,
  RegistrationPayload,
} from "../api/types";

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
