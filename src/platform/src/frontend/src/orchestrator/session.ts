import type { CourseVersionPayload } from "@znawca/datasource/payload";
import type { BackendApi } from "./types";

/** 一次进行中的活动：引擎挂载所需的全部输入。 */
export interface ActiveActivity {
  readonly sessionId: string;
  readonly courseTitle: string;
  readonly payload: CourseVersionPayload;
  readonly mode: "L" | "T";
  readonly randomSeed: number;
  readonly itemCount: number | null;
  readonly resumeToken: unknown | null;
  readonly resumed: boolean;
}

/**
 * 进入课程（契约§三恢复逻辑）：
 * 1. 先查 GET /api/sessions/?status=active&courseVersionId=，有则带 resumeToken 恢复；
 * 2. 无则 POST /api/sessions/ 建新会话（randomSeed 由后端生成，随响应或 payload 下发）。
 */
export async function enterCourse(
  backend: BackendApi,
  courseVersionId: string,
  mode: "L" | "T",
  itemCount: number | null = null,
): Promise<ActiveActivity> {
  const [active, payload] = await Promise.all([
    backend.findActiveSession(courseVersionId),
    backend.getPayload(courseVersionId),
  ]);
  if (active) {
    return {
      sessionId: active.sessionId,
      courseTitle: payload.title,
      payload,
      mode: active.mode,
      randomSeed: active.randomSeed ?? payload.randomSeed ?? 1,
      itemCount: active.itemCount ?? itemCount,
      resumeToken: active.resumeToken,
      resumed: true,
    };
  }
  const created = await backend.createSession({
    courseVersionId,
    mode,
    ...(itemCount !== null ? { itemCount } : {}),
  });
  return {
    sessionId: created.sessionId,
    courseTitle: payload.title,
    payload,
    mode,
    randomSeed: created.randomSeed ?? payload.randomSeed ?? 1,
    itemCount,
    resumeToken: null,
    resumed: false,
  };
}
