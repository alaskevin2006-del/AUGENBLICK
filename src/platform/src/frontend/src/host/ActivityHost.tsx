import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import type { AuthUser } from "../orchestrator/types";
import { TopBar } from "../shell/TopBar";
import { useT } from "../i18n";

/**
 * Activity Host（契约§五 UI 宿主）：统一外框——
 * 全局顶栏（含活动标题+退出按钮，退出前确认）、E_TECH 错误边界、主题容器。
 * 引擎挂进内容区。
 */
export function ActivityHost({
  title,
  user,
  onNavigate,
  onLogout,
  onExit,
  children,
}: {
  title: string;
  readonly user: AuthUser;
  readonly onNavigate: (screen: "courses" | "developer") => void;
  readonly onLogout: () => void;
  /** 确认退出后回调（编排器负责 flush 事件并返回课程列表）。 */
  onExit(): void;
  children: ReactNode;
}) {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="host-shell">
      <TopBar
        user={user}
        onNavigate={onNavigate}
        onLogout={onLogout}
        title={title}
        actions={
          <button className="metal-button" type="button" onClick={() => setConfirmOpen(true)}>
            {t("exit.confirm")}
          </button>
        }
      />
      <div className="host-content">
        <ActivityErrorBoundary onExit={onExit}>{children}</ActivityErrorBoundary>
      </div>
      {confirmOpen && (
        <div className="dialog-backdrop">
          <section className="host-dialog" role="dialog" aria-modal="true" aria-label={t("exit.title")}>
            <h1>{t("exit.title")}</h1>
            <p>{t("exit.body")}</p>
            <div className="dialog-actions">
              <button className="metal-button" type="button" onClick={() => setConfirmOpen(false)}>{t("exit.stay")}</button>
              <button className="gold-button" type="button" onClick={() => { setConfirmOpen(false); onExit(); }}>{t("exit.confirm")}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

interface BoundaryState {
  readonly error: Error | null;
}

/** E_TECH：活动技术失败 → 展示「该活动暂时不可用」并允许返回。 */
class ActivityErrorBoundary extends Component<{ onExit(): void; children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 诊断日志（E_TECH 语义：学习者看到降级界面，技术细节进日志）。
    console.error("[E_TECH] activity crashed", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return <HostErrorView onExit={this.props.onExit} />;
    }
    return this.props.children;
  }
}

/** 错误界面单独成组件以便使用 i18n hook。 */
function HostErrorView({ onExit }: { readonly onExit: () => void }) {
  const t = useT();
  return (
    <div className="host-error" role="alert">
      <div>
        <h1>{t("hostError.title")}</h1>
        <p>{t("hostError.body")}</p>
        <button className="gold-button" type="button" onClick={onExit}>{t("results.back")}</button>
      </div>
    </div>
  );
}
