import type { CourseVersionPayload } from "@znawca/datasource/payload";
import type { EngineEvent } from "@znawca/adapter/ZnawcaActivity";
import {
  ApiError,
  type AuthUser,
  type BackendApi,
  type CourseSummary,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type LoginResponse,
  type PushEventsResponse,
  type SessionInfo,
  type UploadResult,
} from "./types";
import { clearAuth, getToken } from "./auth";
import { MockBackend } from "../dev/mockBackend";

// 契约§三/§八/§九 REST client。开发期后端不可用时自动降级到 MockBackend（localStorage）。

/** 统一 401 处理：App 注册——清 token、跳登录页。 */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // multipart 由浏览器自动生成 boundary，不手动设 Content-Type。
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Token ${token}`);
  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) {
    // 契约§八：任何 401 → 清 token 跳登录页。
    clearAuth();
    unauthorizedHandler?.();
    throw new ApiError(401, `API ${path} → 401`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, `API ${path} → ${response.status}`, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

class HttpBackend implements BackendApi {
  login(username: string, password: string): Promise<LoginResponse> {
    return request("/api/auth/login/", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  logout(): Promise<void> {
    return request("/api/auth/logout/", { method: "POST" });
  }

  me(): Promise<AuthUser> {
    return request("/api/auth/me/");
  }

  listCourses(): Promise<readonly CourseSummary[]> {
    return request("/api/courses/");
  }

  getPayload(courseVersionId: string): Promise<CourseVersionPayload> {
    return request(`/api/courses/${encodeURIComponent(courseVersionId)}/payload/`);
  }

  createSession(body: CreateSessionRequest): Promise<CreateSessionResponse> {
    return request("/api/sessions/", { method: "POST", body: JSON.stringify(body) });
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const raw = await request<Record<string, unknown>>(`/api/sessions/${encodeURIComponent(sessionId)}/`);
    return normalizeSession(raw);
  }

  async findActiveSession(courseVersionId: string): Promise<SessionInfo | null> {
    const raw = await request<unknown>(
      `/api/sessions/?status=active&courseVersionId=${encodeURIComponent(courseVersionId)}`,
    );
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { results?: unknown[] })?.results)
        ? (raw as { results: unknown[] }).results
        : [];
    // MVP：每课程版本取最新一条 active。
    const latest = list[list.length - 1] as Record<string, unknown> | undefined;
    return latest ? normalizeSession(latest) : null;
  }

  pushEvents(sessionId: string, events: readonly EngineEvent[], resumeToken?: unknown): Promise<PushEventsResponse> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/events/`, {
      method: "POST",
      body: JSON.stringify({ events, ...(resumeToken !== undefined ? { resumeToken } : {}) }),
    });
  }

  uploadCourse(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file);
    return request("/api/dev/courses/upload/", { method: "POST", body: form });
  }
}

/** 后端会话对象各字段命名可能有 id/sessionId 差异，归一化为 SessionInfo。 */
function normalizeSession(raw: Record<string, unknown>): SessionInfo {
  return {
    sessionId: String(raw.sessionId ?? raw.id ?? ""),
    status: (raw.status as SessionInfo["status"]) ?? "active",
    mode: (raw.mode as "L" | "T") ?? "L",
    courseVersionId: String(raw.courseVersionId ?? ""),
    itemCount: (raw.itemCount as number | null | undefined) ?? null,
    totalScore: (raw.totalScore as number | null | undefined) ?? null,
    resumeToken: raw.resumeToken ?? null,
    eventCount: Number(raw.eventCount ?? 0),
    ...(typeof raw.randomSeed === "number" ? { randomSeed: raw.randomSeed } : {}),
  };
}

let cached: Promise<BackendApi> | undefined;

/** 开发期强制 mock 开关：localStorage `augenblick.dev.forceMock` = "1"。 */
function isForceMock(): boolean {
  try {
    return localStorage.getItem("augenblick.dev.forceMock") === "1";
  } catch {
    return false;
  }
}

/**
 * 探测真实后端；网络不可达或认证端点未就绪时降级 mock（仅开发期路径，联调后自动走 HTTP）。
 * 任意 HTTP 响应（含 401，未登录时）都说明后端在线；仅 fetch 网络异常才走 mock。
 */
export function getBackend(): Promise<BackendApi> {
  cached ??= (async (): Promise<BackendApi> => {
    if (isForceMock()) return new MockBackend();
    try {
      await fetch("/api/courses/");
      // 契约§八联调前：后端在线但 /api/auth/login/ 未实现（404）→ 同样降级 mock。
      // （用 POST 探测：DRF 路由缺失 → 404；已实现但未带 body → 400。OPTIONS 会被中间件统一 204，不可靠。）
      const authProbe = await fetch("/api/auth/login/", { method: "POST" });
      if (authProbe.status === 404) return new MockBackend();
      return new HttpBackend();
    } catch {
      return new MockBackend();
    }
  })();
  return cached;
}

/** 登录/登出后重新探测（mock ↔ 真实后端切换）。 */
export function resetBackend(): void {
  cached = undefined;
}
