import type { CourseVersionPayload } from "@znawca/datasource/payload";
import type { RuntimeSnapshot, AnswerRequest } from "@znawca/adapter/runtime";
import type { EngineEvent } from "@znawca/adapter/ZnawcaActivity";

/** 契约§三：课程版本列表条目。 */
export interface CourseSummary {
  readonly courseVersionId: string;
  readonly title: string;
  readonly languageCode: string;
  readonly engine: string;
  readonly itemCount: number;
  readonly status?: "draft" | "published";
  readonly publishedAt?: string | null;
  readonly isEnrolled?: boolean;
}

/** 契约§三：会话状态。 */
export interface SessionInfo {
  readonly sessionId: string;
  readonly status: "active" | "finished" | "cancelled";
  readonly mode: "L" | "T";
  readonly courseVersionId: string;
  readonly itemCount?: number | null;
  readonly totalScore: number | null;
  readonly resumeToken: unknown | null;
  readonly eventCount: number;
  /** 建会话时后端生成的种子（T 模式确定性选题恢复依赖；随会话/payload 下发）。 */
  readonly randomSeed?: number;
}

export interface CreateSessionRequest {
  readonly courseVersionId: string;
  readonly mode: "L" | "T";
  readonly itemCount?: number | null;
  readonly kinds?: readonly string[];
  readonly directions?: readonly string[];
  readonly filters?: readonly CourseFilter[];
  readonly preview?: boolean;
  readonly difficultOnly?: boolean;
}

export interface CreateSessionResponse {
  readonly sessionId: string;
  readonly attemptId: string;
  readonly resumed: boolean;
  readonly randomSeed?: number;
}

export interface PushEventsResponse {
  readonly accepted: number;
  readonly status: string;
}

/** 契约§八：认证用户（isDeveloper = 后端 is_staff）。 */
export interface AuthUser {
  readonly username: string;
  readonly isDeveloper: boolean;
}

export interface LoginResponse {
  readonly token: string;
  readonly user: AuthUser;
}

/** 契约§九：上传成功的单版本导入结果。 */
export interface UploadImportedItem {
  readonly courseVersionId: string;
  readonly title: string;
  readonly languageCode: string;
  readonly itemCount: number;
  readonly reused: boolean;
}

export interface UploadResult {
  readonly imported: readonly UploadImportedItem[];
  readonly warnings: readonly string[];
}

/** API 错误：带 HTTP 状态与响应体（登录 400 取 body.error 展示）。 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** 编排器对后端的全部依赖（契约§三/§八/§九端点；mock 后端实现同一接口）。 */
export interface BackendApi {
  login(username: string, password: string): Promise<LoginResponse>;
  logout(): Promise<void>;
  me(): Promise<AuthUser>;
  listDeveloperCourses(): Promise<readonly CourseSummary[]>;
  listMyCourses(): Promise<readonly CourseSummary[]>;
  publishCourse(id: string): Promise<CourseSummary>;
  unpublishCourse(id: string): Promise<CourseSummary>;
  courseSetup(id: string, config: SetupConfig): Promise<CourseSetup>;
  unenrollCourse(id: string): Promise<CourseSummary>;
  history(courseVersionId?: string, page?: number): Promise<HistoryPage>;
  historyDetail(id: string): Promise<RuntimeSnapshot>;
  difficulties(courseVersionId?: string): Promise<readonly DifficultyGroup[]>;
  enrollCourse(id: string): Promise<CourseSummary>;
  listCourses(): Promise<readonly CourseSummary[]>;
  getPayload(courseVersionId: string): Promise<CourseVersionPayload>;
  createSession(request: CreateSessionRequest): Promise<RuntimeSnapshot>;
  answer(sessionId: string, request: AnswerRequest): Promise<RuntimeSnapshot>;
  advance(
    sessionId: string,
    action: "next" | "finish" | "skip",
    questionId?: string,
    submissionId?: string,
  ): Promise<RuntimeSnapshot>;
  getSession(sessionId: string): Promise<RuntimeSnapshot>;
  findActiveSession(courseVersionId: string): Promise<SessionInfo | null>;
  pushEvents(
    sessionId: string,
    events: readonly EngineEvent[],
    resumeToken?: unknown,
  ): Promise<PushEventsResponse>;
  uploadCourse(
    file: File,
    onProgress?: (state: UploadProgress) => void,
  ): Promise<UploadResult>;
}

export interface UploadProgress {
  readonly phase: "uploading" | "processing";
  readonly percent: number;
}

export interface CourseFilter { readonly field: string; readonly values: readonly string[] }
export interface SetupConfig { readonly difficultOnly?: boolean; readonly kinds?: readonly string[]; readonly directions?: readonly string[]; readonly filters?: readonly CourseFilter[] }
export interface CourseSetup {
 readonly course: CourseSummary;
 readonly availableQuestionCount: number;
 readonly availableObjectCount: number;
 readonly kinds: readonly {value: string; count: number}[];
 readonly directions: readonly {value: string; count: number}[];
 readonly filters: readonly CourseFilter[];
 readonly testSubmitted: boolean;
}

export interface HistoryEntry {sessionId:string; courseVersionId:string; title:string; mode:"L"|"T"; status:"finished"|"skipped"|"cancelled"; isPreview:boolean; totalScore:number|null; createdAt:string; updatedAt:string; progress:{total:number;completed:number;remaining:number}}
export interface HistoryPage {results:readonly HistoryEntry[]; nextPage:number|null}
export interface DifficultyGroup {course:CourseSummary; items:readonly {objectId:string;name:string;consecutiveCorrect:number;lastPracticedAt:string}[]}
