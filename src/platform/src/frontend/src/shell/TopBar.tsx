import type { ReactNode } from "react";
import type { AuthUser } from "../orchestrator/types";
import { localeNames, setLocale, shellLocales, useLocale, useT } from "../i18n";

/**
 * 全局顶栏（契约§十）：品牌名｜（开发者入口）｜语言切换｜用户名｜退出登录。
 * ActivityHost 复用时传 title（活动标题）与 actions（退出按钮）。
 */
export function TopBar({
  user,
  onNavigate,
  onLogout,
  title,
  actions,
}: {
  readonly user: AuthUser;
  readonly onNavigate: (screen: "courses" | "developer") => void;
  readonly onLogout: () => void;
  readonly title?: string;
  readonly actions?: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <header className="title-bar">
      <div className="topbar-side">
        <button className="brand" type="button" onClick={() => onNavigate("courses")}>
          <span className="brand-mark">A</span>
          <span>AUGENBLICK</span>
        </button>
        {title && <span className="host-title" dir="auto">{title}</span>}
      </div>
      <div className="title-actions">
        {user.isDeveloper && (
          <button className="metal-button" type="button" onClick={() => onNavigate("developer")}>
            {t("nav.developer")}
          </button>
        )}
        <select
          className="topbar-select"
          aria-label={t("nav.language")}
          value={locale}
          onChange={(event) => setLocale(event.target.value as typeof locale)}
        >
          {shellLocales.map((entry) => (
            <option key={entry} value={entry}>{localeNames[entry]}</option>
          ))}
        </select>
        <span className="topbar-user">{user.username}</span>
        <button className="metal-button" type="button" onClick={onLogout}>{t("nav.logout")}</button>
        {actions}
      </div>
    </header>
  );
}
