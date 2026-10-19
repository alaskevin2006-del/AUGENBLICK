import type { EngineEvent } from "@znawca/adapter/ZnawcaActivity";
import type { BackendApi } from "./types";

interface QueuedEvent {
  readonly event: EngineEvent;
  readonly resumeToken: unknown;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

/**
 * 事件推送队列（契约§五编排器职责）：
 * - onEvent 累积后批量 POST /events/；
 * - 失败指数退避重试（500ms → 30s 封顶），队列不丢；
 * - 页面卸载前用 sendBeacon flush 剩余事件。
 */
export class EventQueue {
  private pending: QueuedEvent[] = [];
  private flushing = false;
  private backoff = INITIAL_BACKOFF_MS;
  private timer: number | undefined;
  private readonly onPageHide = (): void => this.beaconFlush();

  constructor(
    private readonly backend: BackendApi,
    private readonly sessionId: string,
  ) {
    window.addEventListener("pagehide", this.onPageHide);
  }

  push(event: EngineEvent, resumeToken: unknown): void {
    this.pending.push({ event, resumeToken });
    this.scheduleFlush(0);
  }

  /** 退出活动前调用：尽力把剩余事件发完。 */
  async drain(): Promise<void> {
    window.clearTimeout(this.timer);
    await this.flush();
  }

  dispose(): void {
    window.removeEventListener("pagehide", this.onPageHide);
    window.clearTimeout(this.timer);
  }

  private scheduleFlush(delay: number): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), delay);
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    // 同一批次带最后一个 resumeToken（后端只存最新值）。
    const batch = this.pending;
    const sentCount = batch.length; // 发送前定格数量：await 期间新 push 的事件不属于本批
    const resumeToken = batch[batch.length - 1]!.resumeToken;
    try {
      await this.backend.pushEvents(
        this.sessionId,
        batch.slice(0, sentCount).map((entry) => entry.event),
        resumeToken,
      );
      // 只移除已发送的；await 期间新进的事件保留并立即续发（否则丢事件 → 服务端 seq 断档 → 永久 409）。
      this.pending.splice(0, sentCount);
      this.backoff = INITIAL_BACKOFF_MS;
      if (this.pending.length > 0) this.scheduleFlush(0);
    } catch {
      // 失败保留队列，指数退避后重试。
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
      this.scheduleFlush(this.backoff);
    } finally {
      this.flushing = false;
    }
  }

  /** 卸载前最后手段：sendBeacon 一次性提交剩余事件（尽力而为，不重试）。 */
  private beaconFlush(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const body = JSON.stringify({
      events: batch.map((entry) => entry.event),
      resumeToken: batch[batch.length - 1]!.resumeToken,
    });
    navigator.sendBeacon(
      `/api/sessions/${encodeURIComponent(this.sessionId)}/events/`,
      new Blob([body], { type: "application/json" }),
    );
  }
}
