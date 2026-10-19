import type { CourseVersionPayload } from "@znawca/datasource/payload";
import type { EngineEvent } from "@znawca/adapter/ZnawcaActivity";
import {
  ApiError,
  type AuthUser,
  type HistoryPage,
  type DifficultyGroup,
  type CourseSetup,
  type CourseRecords,
  type SetupConfig,
  type BackendApi,
  type CourseSummary,
  type CreateSessionRequest,
  type LoginResponse,
  type PushEventsResponse,
  type SessionInfo,
  type UploadResult,
  type UploadProgress,
} from "./types";
import { uploadCourseFile } from "./upload";
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
    if (token === getToken()) {
      clearAuth();
      unauthorizedHandler?.();
    }
    throw new ApiError(401, `API ${path} → 401`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      `API ${path} → ${response.status}`,
      body,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

class HttpBackend implements BackendApi {
  courseReference(id:string):Promise<any>{return request(`/api/courses/${encodeURIComponent(id)}/reference/`);}
  practice(sessionId:string,questionId:string,answer:string):Promise<import('@znawca/adapter/runtime').RuntimeFeedback>{return request(`/api/sessions/${sessionId}/practice/`,{method:'POST',body:JSON.stringify({questionId,answer})});}
  login(username: string, password: string): Promise<LoginResponse> {
    return request("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
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

  listDeveloperCourses(): Promise<readonly CourseSummary[]> {
    return request("/api/dev/courses/");
  }
  listMyCourses(): Promise<readonly CourseSummary[]> {
    return request("/api/my-courses/");
  }
  publishCourse(id: string): Promise<CourseSummary> {
    return request(`/api/dev/courses/${encodeURIComponent(id)}/publish/`, {
      method: "POST",
    });
  }
  unpublishCourse(id: string): Promise<CourseSummary> {
    return request(`/api/dev/courses/${encodeURIComponent(id)}/unpublish/`, {method: "POST"});
  }
  courseSetup(id: string, config: SetupConfig): Promise<CourseSetup> {
    return request(`/api/courses/${encodeURIComponent(id)}/setup/`, {method: "POST", body: JSON.stringify(config)});
  }
  unenrollCourse(id: string): Promise<CourseSummary> {return request(`/api/courses/${encodeURIComponent(id)}/unenroll/`, {method:"POST"});}
  courseRecords(id:string):Promise<CourseRecords>{return request(`/api/courses/${encodeURIComponent(id)}/records/`);}
  recordCourses():Promise<readonly CourseSummary[]>{return request("/api/record-courses/");}
  history(courseVersionId:string, page=1,mode?:"L"|"T"):Promise<HistoryPage> {if(!courseVersionId) return Promise.reject(new Error("Course required"));return request(`/api/history/?page=${page}&courseVersionId=${encodeURIComponent(courseVersionId)}${mode?`&mode=${mode}`:""}`);}
  historyDetail(id:string):Promise<RuntimeSnapshot> {return request(`/api/history/${encodeURIComponent(id)}/`);}
  difficulties(courseVersionId:string):Promise<readonly DifficultyGroup[]> {if(!courseVersionId)return Promise.reject(new Error("Course required"));return request(`/api/difficulties/?courseVersionId=${encodeURIComponent(courseVersionId)}`);}
  enrollCourse(id: string): Promise<CourseSummary> {
    return request(`/api/courses/${encodeURIComponent(id)}/enroll/`, {
      method: "POST",
    });
  }

  getPayload(courseVersionId: string): Promise<CourseVersionPayload> {
    return request(
      `/api/courses/${encodeURIComponent(courseVersionId)}/payload/`,
    );
  }

  createSession(body: CreateSessionRequest): Promise<RuntimeSnapshot> {
    return request("/api/sessions/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  answer(sessionId: string, body: AnswerRequest): Promise<RuntimeSnapshot> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/answer/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  advance(
    sessionId: string,
    action: "next" | "finish" | "skip",
    questionId?: string,
    submissionId?: string,
  ): Promise<RuntimeSnapshot> {
    return request(
      `/api/sessions/${encodeURIComponent(sessionId)}/${action}/`,
      {
        method: "POST",
        ...(action === "next"
          ? { body: JSON.stringify({ questionId, submissionId }) }
          : {}),
      },
    );
  }

  getSession(sessionId: string): Promise<RuntimeSnapshot> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/`);
  }

  async findActiveSession(
    courseVersionId: string,
  ): Promise<SessionInfo | null> {
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

  pushEvents(
    sessionId: string,
    events: readonly EngineEvent[],
    resumeToken?: unknown,
  ): Promise<PushEventsResponse> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/events/`, {
      method: "POST",
      body: JSON.stringify({
        events,
        ...(resumeToken !== undefined ? { resumeToken } : {}),
      }),
    });
  }

  async uploadCourse(
    file: File,
    onProgress?: (state: UploadProgress) => void,
  ): Promise<UploadResult> {
    const uploadToken = getToken();
    try {
      return await uploadCourseFile(file, onProgress);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        uploadToken === getToken()
      ) {
        clearAuth();
        unauthorizedHandler?.();
      }
      throw error;
    }
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
    ...(typeof raw.randomSeed === "number"
      ? { randomSeed: raw.randomSeed }
      : {}),
  };
}

let cached: Promise<BackendApi> | undefined;

// Network failures must never silently switch learners to browser-owned records.
export function getBackend(): Promise<BackendApi> {
  return (cached ??= Promise.resolve(new HttpBackend()));
}
export function resetBackend(): void {
  cached = undefined;
}
