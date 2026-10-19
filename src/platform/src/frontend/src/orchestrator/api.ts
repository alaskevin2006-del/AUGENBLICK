import type { CourseVersionPayload } from "@znawca/datasource/payload";
import type { EngineEvent } from "@znawca/adapter/ZnawcaActivity";
import {
  ApiError,
  type AuthUser,
  type BackendApi,
  type CourseSummary,
  type CreateSessionRequest,
  type LoginResponse,
  type PushEventsResponse,
  type SessionInfo,
  type UploadResult,
} from "./types";
import { clearAuth, getToken } from "./auth";
import type { RuntimeSnapshot, AnswerRequest } from "@znawca/adapter/runtime";

// Authenticated REST client; errors remain visible to the learner.

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

  createSession(body: CreateSessionRequest): Promise<RuntimeSnapshot> {
    return request("/api/sessions/", { method: "POST", body: JSON.stringify(body) });
  }

  answer(sessionId: string, body: AnswerRequest): Promise<RuntimeSnapshot> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/answer/`, {method: "POST", body: JSON.stringify(body)});
  }
  advance(sessionId: string, action: "next" | "finish" | "skip"): Promise<RuntimeSnapshot> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/${action}/`, {method: "POST"});
  }

  getSession(sessionId: string): Promise<RuntimeSnapshot> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/`);
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

// Network failures must never silently switch learners to browser-owned records.
export function getBackend(): Promise<BackendApi> {
  return cached ??= Promise.resolve(new HttpBackend());
}
export function resetBackend(): void { cached = undefined; }
