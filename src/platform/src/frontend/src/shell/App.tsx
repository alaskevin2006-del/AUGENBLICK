import { useCallback, useEffect, useRef, useState } from "react";
import { ZnawcaActivity } from "@znawca/adapter/ZnawcaActivity";
import { getBackend, resetBackend, setUnauthorizedHandler } from "../orchestrator/api";
import { clearAuth, getStoredUser, getToken } from "../orchestrator/auth";
import { enterCourse, type ActiveActivity } from "../orchestrator/session";
import type { AuthUser, BackendApi, CourseSummary } from "../orchestrator/types";
import { ActivityHost } from "../host/ActivityHost";
import { CourseListPage } from "./CourseListPage";
import { LoginPage } from "./LoginPage";
import { DeveloperPage } from "./DeveloperPage";
import { TopBar } from "./TopBar";
import { textDirection, useLocale, useT } from "../i18n";

type Screen =
  | { readonly kind: "courses" }
  | { readonly kind: "developer" }
  | { readonly kind: "activity"; readonly activity: ActiveActivity };

/** 平台外壳：登录门 + 最简 state 路由（课程列表 / 开发者页 / 活动 / 结果页）。 */
export function App() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getStoredUser() : null));
  const [screen, setScreen] = useState<Screen>({ kind: "courses" });
  const [courses, setCourses] = useState<readonly CourseSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const backendRef = useRef<BackendApi | null>(null);
  const openingRef = useRef(false);
  const [opening, setOpening] = useState(false);

  // 契约§十：ar → 根容器 dir=rtl；同步 <html lang>。
  useEffect(() => {
    document.documentElement.dir = textDirection(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const doLogout = useCallback((): void => {
    // Invalidate the server token and clear this browser session.
    void (async () => {
      await backendRef.current?.logout().catch(() => undefined);
      clearAuth();
      resetBackend();
      setUser(null);
      setScreen({ kind: "courses" });
    })();
  }, []);

  // 统一 401：清 token（request 内已清）→ 回登录页。
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setScreen({ kind: "courses" });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const refreshCourses = useCallback(async (): Promise<void> => {
    try {
      const backend = await getBackend();
      backendRef.current = backend;
      const list = await backend.listCourses();
      setCourses(list);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  // 已登录：校验 token（me()，401 由统一 handler 接管）并加载课程。
  useEffect(() => {
    if (!user) return;
    void getBackend()
      .then((backend) => backend.me())
      .then(setUser)
      .catch(() => undefined);
    void refreshCourses();
  }, [user === null, refreshCourses]);

  const openActivity = async (courseVersionId: string, mode: "L" | "T"): Promise<void> => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    try {
      const backend = backendRef.current ?? (await getBackend());
      backendRef.current = backend;
      const title = courses.find(course => course.courseVersionId === courseVersionId)?.title ?? "";
      const activity = await enterCourse(backend, courseVersionId, mode, title);
      setLoadError(null);
      setScreen({kind: "activity", activity});
    } catch { setLoadError(t("activity.startError")); }
    finally { openingRef.current = false; setOpening(false); }
  };
  const closeActivity = (): void => {
    setScreen({kind: "courses"});
    void refreshCourses();
  };
  const navigate = (target: "courses" | "developer"): void => {
    setScreen({kind: target});
    if (target === "courses") void refreshCourses();
  };

  // 未登录：任何页面 → 登录页。
  if (!user) {
    return <LoginPage onSuccess={(loggedIn) => { setUser(loggedIn); setScreen({ kind: "courses" }); }} />;
  }

  if (screen.kind === "activity") {
    const { activity } = screen;
    return (
      <ActivityHost
        title={`${activity.courseTitle} · ${activity.mode === "L" ? t("courses.learn") : t("courses.test")}`}
        user={user}
        onNavigate={navigate}
        onLogout={doLogout}
        onExit={() => void closeActivity()}
      >
        <ZnawcaActivity
          key={activity.sessionId}
          courseTitle={activity.courseTitle}
          initialSnapshot={activity.snapshot}
          api={backendRef.current!}
          interfaceLang={locale}
          labels={{error: t("activity.error"), retry: t("error.retry"), finish: t("activity.finish"), skip: t("activity.skip"), skipped: t("activity.skipped"), pending: t("activity.pending")}}
          onExit={() => void closeActivity()}
        />
      </ActivityHost>
    );
  }

  return (
    <main className="app-shell">
      <TopBar user={user} onNavigate={navigate} onLogout={doLogout} />
      {screen.kind === "developer" ? (
        <DeveloperPage isDeveloper={user.isDeveloper} courses={courses} onUploaded={() => void refreshCourses()} />
      ) : loadError ? (
        <div className="host-error" role="alert">
          <div>
            <h1>{t("error.loadFailed")}</h1>
            <p>{loadError}</p>
            <button className="gold-button" onClick={() => void refreshCourses()}>{t("error.retry")}</button>
          </div>
        </div>
      ) : (
        <CourseListPage disabled={opening} courses={courses} onEnter={(id, mode) => void openActivity(id, mode)} />
      )}
    </main>
  );
}
