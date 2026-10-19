import type { RuntimeSnapshot } from "@znawca/adapter/runtime";
import type { BackendApi } from "./types";
export interface ActiveActivity {
  readonly sessionId: string;
  readonly courseTitle: string;
  readonly snapshot: RuntimeSnapshot;
  readonly mode: "L" | "T";
}
/** Each entry restarts the selected unfinished activity; completed tests are rejected by the server. */
export async function enterCourse(backend: BackendApi, courseVersionId: string, mode: "L" | "T", courseTitle: string): Promise<ActiveActivity> {
  const snapshot = await backend.createSession({courseVersionId, mode});
  return {sessionId: snapshot.sessionId, courseTitle, snapshot, mode};
}
