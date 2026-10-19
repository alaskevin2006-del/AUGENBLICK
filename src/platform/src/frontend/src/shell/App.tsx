import { useCallback, useEffect, useRef, useState } from "react";
import { ZnawcaActivity } from "@znawca/adapter/ZnawcaActivity";
import {
  getBackend,
  resetBackend,
  setUnauthorizedHandler,
} from "../orchestrator/api";
import { clearAuth, getStoredUser, getToken } from "../orchestrator/auth";
import { enterCourse, type ActiveActivity } from "../orchestrator/session";
import { roleRoute, courseRoute, recordsCourse, type PageRoute } from "../orchestrator/routes";
import {
  ApiError,
  type AuthUser,
  type BackendApi,
  type CourseSummary,
  type CreateSessionRequest,
} from "../orchestrator/types";
import { ActivityHost } from "../host/ActivityHost";
import { CourseSetupPage, type SetupPreferences } from "./CourseSetupPage";
import { CourseListPage } from "./CourseListPage";
import { LoginPage } from "./LoginPage";
import { DeveloperPage } from "./DeveloperPage";
import { RecordsPage } from "./RecordsPage";
import { TopBar } from "./TopBar";
import { textDirection, useLocale, useT, type ShellKey } from "../i18n";
export function App() {
  const t = useT();
  const locale = useLocale();
  const [user, setUser] = useState<AuthUser | null>(() =>
    getToken() ? getStoredUser() : null,
  );
  const [hash, setHash] = useState(() => window.location.hash);
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [courses, setCourses] = useState<readonly CourseSummary[]>([]);
  const [failure, setFailure] = useState<ShellKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const backendRef = useRef<BackendApi | null>(null);
  const lock = useRef(false);
  const setupPreferences = useRef<Record<string, SetupPreferences>>({});
  const generation = useRef(0);
  const identity = useRef(0);
  const navigation = useRef(0);
  const currentUser = useRef(user);
  currentUser.current = user;
  const invalidateNavigation = () => {
    navigation.current++;
    generation.current++;
    lock.current = false;
    setBusy(false);
  };
  const routedHash = useRef(hash);
  routedHash.current = hash;
  const courseId = courseRoute(hash);
  const recordCourseId = recordsCourse(hash);
  const route = user ? roleRoute(user, hash) : "courses";
  useEffect(() => {
    document.documentElement.dir = textDirection(locale);
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    const changed = () => {
      if (window.location.hash === routedHash.current) return;
      routedHash.current = window.location.hash;
      invalidateNavigation();
      setHash(window.location.hash);
      setActivity(null);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const navigate = (target: PageRoute) => {
    invalidateNavigation();
    const safe = user ? roleRoute(user, `#/${target}`) : "courses";
    setActivity(null);
    setFailure(null);
    routedHash.current = `#/${safe}`;
    window.location.hash = `/${safe}`;
    setHash(`#/${safe}`);
    if (safe === route) void refresh();
  };
  const loggedOut = useCallback(() => {
    identity.current++;
    navigation.current++;
    generation.current++;
    currentUser.current = null;
    lock.current = false;
    setBusy(false);
    clearAuth();
    resetBackend();
    backendRef.current = null;
    setupPreferences.current = {};
    setUser(null);
    setCourses([]);
    setActivity(null);
    setFailure(null);
  }, []);
  useEffect(() => {
    setUnauthorizedHandler(loggedOut);
    return () => setUnauthorizedHandler(null);
  }, [loggedOut]);
  const logout = () => {
    // Start the request while the old token is still present; clear UI immediately.
    const revoke = backendRef.current?.logout();
    loggedOut();
    void revoke?.catch(() => undefined);
  };
  useEffect(() => {
    if (!user) return;
    const epoch = identity.current;
    const token = getToken();
    void getBackend()
      .then(async (backend) => {
        if (identity.current !== epoch || getToken() !== token) return;
        const verified = await backend.me();
        if (identity.current === epoch && getToken() === token)
          setUser(verified);
      })
      .catch(() => undefined);
  }, [user?.username]);
  useEffect(() => {
    if (user && !courseId && route !== "history" && route !== "difficulties" && hash !== `#/${route}`) {
      window.history.replaceState(null, "", `#/${route}`);
      setHash(`#/${route}`);
    }
  }, [user, hash, route, courseId]);
  const refresh = useCallback(async () => {
    if (!user || currentUser.current?.username !== user.username) return;
    const epoch = identity.current;
    const token = getToken();
    const current = ++generation.current;
    const isCurrent = () =>
      epoch === identity.current &&
      token === getToken() &&
      current === generation.current;
    setLoading(true);
    try {
      const backend = await getBackend();
      if (!isCurrent()) return;
      backendRef.current = backend;
      const list = await (user.isDeveloper
        ? backend.listDeveloperCourses()
        : route === "my-courses"
          ? backend.listMyCourses()
          : backend.listCourses());
      if (isCurrent()) {
        setCourses(list);
        setFailure(null);
      }
    } catch {
      if (isCurrent()) setFailure("error.loadFailed");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user?.username, user?.isDeveloper, route]);
  useEffect(() => {
    setCourses([]);
    void refresh();
  }, [refresh]);
  const action = async (
    operation: (isCurrent: () => boolean) => Promise<void>,
    error: ShellKey | ((cause: unknown) => ShellKey) = "action.failed",
  ) => {
    if (lock.current) return;
    const epoch = identity.current;
    const page = navigation.current;
    const token = getToken();
    const isCurrent = () =>
      epoch === identity.current &&
      page === navigation.current &&
      token === getToken();
    lock.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await operation(isCurrent);
    } catch (cause) {
      if (isCurrent())
        setFailure(typeof error === "function" ? error(cause) : error);
    } finally {
      if (isCurrent()) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const openRecords = (target:"history"|"difficulties", id?:string) => {
    invalidateNavigation();setActivity(null);setFailure(null);
    const next = `#/${target}${id ? `?course=${encodeURIComponent(id)}` : ""}`;
    routedHash.current=next;window.location.hash=next;setHash(next);
  };
  const practice = (id:string) => {setupPreferences.current[id]={config:{difficultOnly:true},mode:"L",all:false,quantity:"10"};openSetup(id);};
  const openSetup = (id: string) => {
    invalidateNavigation(); setActivity(null); setFailure(null);
    const target = `#/course/${encodeURIComponent(id)}`;
    routedHash.current = target; window.location.hash = target; setHash(target);
  };
  const open = (id: string, mode: "L" | "T", title: string, config: Omit<CreateSessionRequest, "courseVersionId" | "mode" | "preview">) =>
    void action(
      async (isCurrent) => {
        const backend = backendRef.current ?? (await getBackend());
        if (!isCurrent()) return;
        backendRef.current = backend;
        const opened = await enterCourse(
          backend,
          id,
          mode,
          title,
          Boolean(user?.isDeveloper),
          config,
        );
        if (isCurrent()) setActivity(opened);
      },
      (cause) =>
        cause instanceof ApiError &&
        cause.status === 409 &&
        mode === "T" &&
        !user?.isDeveloper
          ? "activity.submitted"
          : "activity.startError",
    );
  const close = () => {
    invalidateNavigation(); setActivity(null); setFailure(null);
  };
  if (!user)
    return (
      <LoginPage
        onSuccess={(loggedIn) => {
          identity.current++;
          invalidateNavigation();
          currentUser.current = loggedIn;
          setUser(loggedIn);
          setActivity(null);
          const target = loggedIn.isDeveloper ? "developer" : "courses";
          routedHash.current = `#/${target}`;
          window.location.hash = `/${target}`;
          setHash(`#/${target}`);
        }}
      />
    );
  if (activity)
    return (
      <ActivityHost
        title={`${activity.courseTitle} · ${t(activity.mode === "L" ? "courses.learn" : "courses.test")}`}
        user={user}
        onNavigate={navigate}
        onLogout={logout}
        onExit={close}
      >
        <ZnawcaActivity
          key={activity.sessionId}
          courseTitle={activity.courseTitle}
          initialSnapshot={activity.snapshot}
          api={backendRef.current!}
          interfaceLang={locale}
          labels={{
            error: t("activity.error"),
            retry: t("error.retry"),
            finish: t("activity.finish"),
            skip: t("activity.skip"),
            skipped: t("activity.skipped"),
            pending: t("activity.pending"),
          }}
          onExit={close}
        />
      </ActivityHost>
    );
  return (
    <main className="app-shell">
      <TopBar
        user={user}
        active={route}
        onNavigate={navigate}
        onLogout={logout}
      />
      {failure && (
        <div className="inline-error" role="alert">
          <p>{t(failure)}</p>
          <button className="metal-button" onClick={() => void refresh()}>
            {t("error.retry")}
          </button>
        </div>
      )}
      {loading && !courseId && (
        <p className="page-loading" role="status">
          {t("page.loading")}
        </p>
      )}
      {courseId ? <CourseSetupPage key={`${user.username}:${courseId}`} id={courseId} initial={setupPreferences.current[courseId]} onRecords={page=>openRecords(page,courseId)} onPreferences={value => {setupPreferences.current[courseId] = value;}} disabled={busy} onBack={() => navigate(user.isDeveloper ? "developer" : "my-courses")} onStart={(mode, title, config) => open(courseId, mode, title, config)}/> : route === "history" || route === "difficulties" ? <RecordsPage key={`${user.username}:${route}:${recordCourseId??""}`} kind={route} courseId={recordCourseId} isDeveloper={user.isDeveloper} onPractice={practice} onBack={()=>recordCourseId ? openSetup(recordCourseId) : navigate(user.isDeveloper?"developer":"my-courses")}/> : route === "developer" ? (
        <DeveloperPage
          isDeveloper={user.isDeveloper}
          courses={courses}
          disabled={busy || loading}
          onUploaded={refresh}
          onPreview={openSetup}
          onUnpublish={(id) => void action(async (isCurrent) => {
            const backend = backendRef.current ?? (await getBackend());
            if (!isCurrent()) return;
            await backend.unpublishCourse(id);
            if (isCurrent()) await refresh();
          })}
          onPublish={(id) =>
            void action(async (isCurrent) => {
              const backend = backendRef.current ?? (await getBackend());
              if (!isCurrent()) return;
              await backend.publishCourse(id);
              if (isCurrent()) await refresh();
            })
          }
        />
      ) : (
        <CourseListPage
          view={route}
          courses={courses}
          disabled={busy || loading}
          onEnter={openSetup}
          onUnenroll={id=>void action(async isCurrent=>{const backend=backendRef.current??await getBackend();if(!isCurrent())return;await backend.unenrollCourse(id);if(isCurrent())await refresh();})}
          onEnroll={(id) =>
            void action(async (isCurrent) => {
              const backend = backendRef.current ?? (await getBackend());
              if (!isCurrent()) return;
              await backend.enrollCourse(id);
              if (isCurrent()) await refresh();
            })
          }
        />
      )}
    </main>
  );
}
