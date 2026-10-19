import { useState, type FormEvent } from "react";
import { ApiError, type AuthUser } from "../orchestrator/types";
import { getBackend, resetBackend } from "../orchestrator/api";
import { saveAuth } from "../orchestrator/auth";
import { LanguageSelect } from "./TopBar";
import { useT } from "../i18n";

/** 登录页（契约§八）：用户名+密码 → POST /api/auth/login/ → 存 token+user → 回调进课程列表。 */
export function LoginPage({
  onSuccess,
}: {
  readonly onSuccess: (user: AuthUser) => void;
}) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const backend = await getBackend();
      const response = await backend.login(username.trim(), password);
      saveAuth(response.token, response.user);
      resetBackend(); // Use the newly authenticated token on subsequent requests.
      onSuccess(response.user);
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.status === 400 || cause.status === 401)
      ) {
        setError(t("login.badCredentials"));
      } else {
        setError(t("login.networkError"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell login-page">
      <section className="login-card">
        <LanguageSelect />
        <span className="brand">
          <span>AUGENBLICK</span>
        </span>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>{t("login.username")}</span>
            <input
              dir="auto"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            <span>{t("login.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="gold-button large" type="submit" disabled={busy}>
            {busy ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
