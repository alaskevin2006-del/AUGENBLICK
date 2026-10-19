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
} from "../orchestrator/types";
import { getToken } from "../orchestrator/auth";
import { MOCK_COURSE_VERSION_ID, mockCourseList, mockPayload } from "./mockPayload";

// 开发资产（不删）：后端联调前的本地 mock 后端，实现契约§三同一接口。
// 会话存 localStorage，刷新页面后可「继续」；事件按 eventId 幂等去重、seq 校验递增。

const STORAGE_KEY = "augenblick.mock.sessions.v1";

interface MockSession {
  sessionId: string;
  attemptId: string;
  courseVersionId: string;
  mode: "L" | "T";
  itemCount: number | null;
  randomSeed: number;
  status: "active" | "finished" | "cancelled";
  totalScore: number | null;
  resumeToken: unknown | null;
  lastSeq: number;
  eventIds: string[];
  resolvedScores: number[];
}

function loadSessions(): MockSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockSession[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: MockSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function toInfo(session: MockSession): SessionInfo {
  return {
    sessionId: session.sessionId,
    status: session.status,
    mode: session.mode,
    courseVersionId: session.courseVersionId,
    itemCount: session.itemCount,
    totalScore: session.totalScore,
    resumeToken: session.resumeToken,
    eventCount: session.eventIds.length,
    randomSeed: session.randomSeed,
  };
}

// mock 账号与后端 seed 一致：开发者 dev/dev123，学习者 user/user123。
const MOCK_USERS: Readonly<Record<string, { password: string; user: AuthUser }>> = {
  dev: { password: "dev123", user: { username: "dev", isDeveloper: true } },
  user: { password: "user123", user: { username: "user", isDeveloper: false } },
};

export class MockBackend implements BackendApi {
  async login(username: string, password: string): Promise<LoginResponse> {
    const entry = MOCK_USERS[username];
    if (!entry || entry.password !== password) {
      // 契约§八：凭证错误 → 400 {error}
      throw new ApiError(400, "凭证错误", { error: "invalid credentials" });
    }
    return { token: `mock-token-${username}`, user: entry.user };
  }

  async logout(): Promise<void> {
    // mock 无服务端状态
  }

  async me(): Promise<AuthUser> {
    const token = getToken();
    const username = token?.startsWith("mock-token-") ? token.slice("mock-token-".length) : "";
    const entry = MOCK_USERS[username];
    if (!entry) throw new ApiError(401, "未认证");
    return entry.user;
  }

  async uploadCourse(file: File): Promise<UploadResult> {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      // 契约§九：解析/校验失败 → 400 {error, detail}
      throw new ApiError(400, "上传失败", { error: "invalid archive", detail: `文件 ${file.name} 不是 .zip` });
    }
    return {
      imported: [
        {
          courseVersionId: MOCK_COURSE_VERSION_ID,
          title: mockPayload.title,
          languageCode: mockPayload.languageCode ?? "Eng",
          itemCount: mockPayload.items.length,
          reused: true,
        },
      ],
      warnings: ["mock 示例警告：media/demo-missing.jpg 缺失"],
    };
  }

  async listCourses(): Promise<readonly CourseSummary[]> {
    return mockCourseList;
  }

  async getPayload(courseVersionId: string): Promise<CourseVersionPayload> {
    if (courseVersionId !== mockPayload.courseVersionId) throw new Error(`未知课程版本：${courseVersionId}`);
    return mockPayload;
  }

  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const sessions = loadSessions();
    const session: MockSession = {
      sessionId: crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
      courseVersionId: request.courseVersionId,
      mode: request.mode,
      itemCount: request.itemCount ?? null,
      randomSeed: (Math.random() * 0xffffffff) >>> 0,
      status: "active",
      totalScore: null,
      resumeToken: null,
      lastSeq: 0,
      eventIds: [],
      resolvedScores: [],
    };
    sessions.push(session);
    saveSessions(sessions);
    return { sessionId: session.sessionId, attemptId: session.attemptId, resumed: false, randomSeed: session.randomSeed };
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const session = loadSessions().find((entry) => entry.sessionId === sessionId);
    if (!session) throw new Error(`未知会话：${sessionId}`);
    return toInfo(session);
  }

  async findActiveSession(courseVersionId: string): Promise<SessionInfo | null> {
    const active = loadSessions().filter(
      (entry) => entry.courseVersionId === courseVersionId && entry.status === "active",
    );
    return active.length > 0 ? toInfo(active[active.length - 1]!) : null;
  }

  async pushEvents(sessionId: string, events: readonly EngineEvent[], resumeToken?: unknown): Promise<PushEventsResponse> {
    const sessions = loadSessions();
    const session = sessions.find((entry) => entry.sessionId === sessionId);
    if (!session) throw new Error(`未知会话：${sessionId}`);
    const seen = new Set(session.eventIds);
    let accepted = 0;
    for (const event of events) {
      if (seen.has(event.eventId)) continue; // eventId 唯一约束：重复提交去重
      if (event.seq <= session.lastSeq) continue; // seq 必须递增，乱序忽略（mock 宽容处理）
      seen.add(event.eventId);
      session.eventIds.push(event.eventId);
      session.lastSeq = event.seq;
      accepted += 1;
      if (event.type === "itemResolved") {
        const score = (event.payload as { score?: unknown }).score;
        if (typeof score === "number") session.resolvedScores.push(score);
      }
      if (event.type === "activityFinished") {
        session.status = "finished";
        // 后端权威值：以已收 itemResolved 的 score 均值重算。
        session.totalScore = session.resolvedScores.length === 0
          ? 0
          : session.resolvedScores.reduce((sum, value) => sum + value, 0) / session.resolvedScores.length;
      }
    }
    if (resumeToken !== undefined) session.resumeToken = resumeToken;
    saveSessions(sessions);
    return { accepted, status: session.status };
  }
}
