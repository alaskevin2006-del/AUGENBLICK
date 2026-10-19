import type { ReactNode } from "react";
import type { AuthUser } from "../orchestrator/types";
import type { PageRoute } from "../orchestrator/routes";
import { localeNames, setLocale, shellLocales, useLocale, useT } from "../i18n";
export function LanguageSelect() {
  const t = useT();
  const locale = useLocale();
  return (
    <select
      className="topbar-select"
      aria-label={t("nav.language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value as typeof locale)}
    >
      {shellLocales.map((entry) => (
        <option key={entry} value={entry}>
          {localeNames[entry]}
        </option>
      ))}
    </select>
  );
}
export function TopBar({
  user,
  onNavigate,
  onLogout,
  title,
  actions,
  active,
}: {
  readonly user: AuthUser;
  readonly onNavigate: (screen: PageRoute) => void;
  readonly onLogout: () => void;
  readonly title?: string;
  readonly actions?: ReactNode;
  readonly active?: PageRoute;
}) {
  const t = useT();
  return (
    <header className="title-bar">
      <div className="topbar-side">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate(user.isDeveloper ? "developer" : "courses")}
        >
          AUGENBLICK
        </button>
        <nav aria-label={t("courses.eyebrow")}>
          {user.isDeveloper ? (
            <button
              className="nav-link"
              aria-current={active === "developer" ? "page" : undefined}
              onClick={() => onNavigate("developer")}
            >
              {t("nav.developer")}
            </button>
          ) : (
            <>
              <button
                className="nav-link"
                aria-current={active === "courses" ? "page" : undefined}
                onClick={() => onNavigate("courses")}
              >
                {t("nav.select")}
              </button>
              <button
                className="nav-link"
                aria-current={active === "my-courses" ? "page" : undefined}
                onClick={() => onNavigate("my-courses")}
              >
                {t("nav.mine")}
              </button>
            </>
          )}
        </nav>
        {title && (
          <span className="host-title" dir="auto">
            {title}
          </span>
        )}
      </div>
      <div className="title-actions">
        <LanguageSelect />
        <span className="topbar-user">{user.username}</span>
        <button className="metal-button" type="button" onClick={onLogout}>
          {t("nav.logout")}
        </button>
        {actions}
      </div>
    </header>
  );
}
