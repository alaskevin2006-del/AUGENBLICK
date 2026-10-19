import { useCallback, useEffect, useRef, useState } from "react";
import { ZnawcaActivity, type EngineEvent } from "@znawca/adapter/ZnawcaActivity";
import { getBackend, resetBackend, setUnauthorizedHandler } from "../orchestrator/api";
import { clearAuth, getStoredUser, getToken } from "../orchestrator/auth";
import { enterCourse, type ActiveActivity } from "../orchestrator/session";
import { EventQueue } from "../orchestrator/eventQueue";
import type { AuthUser, BackendApi, CourseSummary, SessionInfo } from "../orchestrator/types";
import { ActivityHost } from "../host/ActivityHost";
import { CourseListPage } from "./CourseListPage";
import { ResultsPage } from "./ResultsPage";
import { LoginPage } from "./LoginPage";
import { DeveloperPage } from "./DeveloperPage";
import { TopBar } from "./TopBar";
import { textDirection, useLocale, useT } from "../i18n";

type Screen =
  | { readonly kind: "courses" }
  | { readonly kind: "developer" }
  | { readonly kind: "activity"; readonly activity: ActiveActivity }
  | { readonly kind: "results"; readonly courseTitle: string; readonly totalScore: number | null };

/** 平台外壳：登录门 + 最简 state 路由（课程列表 / 开发者页 / 活动 / 结果页）。 */
export function App() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getStoredUser() : null));
  const [screen, setScreen] = useState<Screen>({ kind: "courses" });
  const [courses, setCourses] = useState<readonly CourseSummary[]>([]);
  const [activeSessions, setActiveSessions] = useState<ReadonlyMap<string, SessionInfo>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const backendRef = useRef<BackendApi | null>(null);
  const queueRef = useRef<EventQueue | null>(null);
  const finishedRef = useRef(false);

  // 契约§十：ar → 根容器 dir=rtl；同步 <html lang>。
  useEffect(() => {
    document.documentElement.dir = textDirection(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const doLogout = useCallback((): void => {
    // 尽力 flush 剩余事件后登出（契约§八：调 logout API → 清本地 → 登录页）。
    void (async () => {
      await queueRef.current?.drain().catch(() => undefined);
      queueRef.current?.dispose();
      queueRef.current = null;
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
      queueRef.current?.dispose();
      queueRef.current = null;
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
      // 每课程版本查一条可恢复会话（MVP：取最新 active）。
      const entries = await Promise.all(
        list.map(async (course) => [course.courseVersionId, await backend.findActiveSession(course.courseVersionId)] as const),
      );
      setActiveSessions(new Map(entries.filter((entry): entry is readonly [string, SessionInfo] => entry[1] !== null)));
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
    return () => queueRef.current?.dispose();
  }, [user === null, refreshCourses]);

  const openActivity = async (courseVersionId: string, mode: "L" | "T"): Promise<void> => {
    const backend = backendRef.current ?? (await getBackend());
    const activity = await enterCourse(backend, courseVersionId, mode);
    queueRef.current?.dispose();
    queueRef.current = new EventQueue(backend, activity.sessionId);
    finishedRef.current = false;
    setScreen({ kind: "activity", activity });
  };

  const closeActivity = async (): Promise<void> => {
    // 退出前尽力 flush 剩余事件（进度随最后一次 resumeToken 已保存）。
    await queueRef.current?.drain();
    if (screen.kind === "activity" && finishedRef.current && backendRef.current) {
      const info = await backendRef.current.getSession(screen.activity.sessionId).catch(() => null);
      setScreen({ kind: "results", courseTitle: screen.activity.courseTitle, totalScore: info?.totalScore ?? null });
    } else {
      setScreen({ kind: "courses" });
      void refreshCourses();
    }
  };

  /** 顶栏导航：离开活动前先 drain（进度随 resumeToken 已保存）。 */
  const navigate = (target: "courses" | "developer"): void => {
    void (async () => {
      if (screen.kind === "activity") await queueRef.current?.drain().catch(() => undefined);
      setScreen({ kind: target });
      if (target === "courses") void refreshCourses();
    })();
  };

  const onEngineEvent = (event: EngineEvent, resumeToken?: unknown): void => {
    if (event.type === "activityFinished") finishedRef.current = true;
    queueRef.current?.push(event, resumeToken);
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
          coursePayload={activity.payload}
          mode={activity.mode}
          randomSeed={activity.randomSeed}
          itemCount={activity.itemCount}
          resumeToken={activity.resumeToken}
          interfaceLang={locale}
          onEvent={onEngineEvent}
          onExit={() => void closeActivity()}
        />
      </ActivityHost>
    );
  }

  return (
    <main className="app-shell">
      <TopBar user={user} onNavigate={navigate} onLogout={doLogout} />
      {screen.kind === "results" ? (
        <ResultsPage
          courseTitle={screen.courseTitle}
          totalScore={screen.totalScore}
          onBack={() => { setScreen({ kind: "courses" }); void refreshCourses(); }}
        />
      ) : screen.kind === "developer" ? (
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
        <CourseListPage courses={courses} activeSessions={activeSessions} onEnter={(id, mode) => void openActivity(id, mode)} />
      )}
    </main>
  );
}
