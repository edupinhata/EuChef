import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiClientError } from "../api/client";
import { useAuth } from "../app/useAuth";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/semana/atual";

  if (user) return <Navigate to={destination} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      if (registering) {
        await register({ displayName, email, password });
      } else {
        await login({ email, password });
      }
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : "Não foi possível concluir a autenticação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="/" aria-label="Mesa da Semana">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>Mesa da Semana</span>
        </a>
        <p className="eyebrow">Sua cozinha organizada</p>
        <h1 id="auth-title">{registering ? "Criar conta" : "Entrar"}</h1>
        <p>
          {registering
            ? "Comece seu planejamento semanal."
            : "Continue preparando sua semana."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {registering && (
            <label className="form-field">
              <span>Nome</span>
              <input
                autoComplete="name"
                maxLength={100}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          )}
          <label className="form-field">
            <span>E-mail</span>
            <input
              autoComplete="email"
              type="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Senha</span>
            <input
              autoComplete={registering ? "new-password" : "current-password"}
              type="password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Aguarde…" : registering ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          className="ghost-button auth-switch"
          type="button"
          onClick={() => {
            setRegistering((current) => !current);
            setError(undefined);
          }}
        >
          {registering ? "Já tenho uma conta" : "Criar minha conta"}
        </button>
      </section>
    </main>
  );
}
