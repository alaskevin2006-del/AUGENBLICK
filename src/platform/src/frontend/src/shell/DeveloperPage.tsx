import { useRef, useState } from "react";
import { ApiError, type CourseSummary, type UploadResult } from "../orchestrator/types";
import { getBackend } from "../orchestrator/api";
import { useT } from "../i18n";

/**
 * 开发者页（契约§九）：课程版本列表 + ZIP 上传。
 * 仅 isDeveloper 可达；非开发者直接访问显示 403 提示。
 */
export function DeveloperPage({
  isDeveloper,
  courses,
  onUploaded,
}: {
  readonly isDeveloper: boolean;
  readonly courses: readonly CourseSummary[];
  readonly onUploaded: () => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [failure, setFailure] = useState<{ error: string; detail: string | null } | null>(null);

  if (!isDeveloper) {
    return (
      <div className="host-error" role="alert">
        <div>
          <h1>{t("dev.forbidden")}</h1>
          <p>{t("dev.forbiddenBody")}</p>
        </div>
      </div>
    );
  }

  const upload = async (): Promise<void> => {
    const file = fileRef.current?.files?.[0];
    setResult(null);
    setFailure(null);
    if (!file) {
      setFailure({ error: t("dev.noFile"), detail: null });
      return;
    }
    setBusy(true);
    try {
      const backend = await getBackend();
      const uploaded = await backend.uploadCourse(file);
      setResult(uploaded);
      onUploaded(); // 刷新课程版本列表
    } catch (cause) {
      if (cause instanceof ApiError) {
        const body = cause.body as { error?: unknown; detail?: unknown } | null;
        setFailure({
          error: typeof body?.error === "string" ? body.error : cause.message,
          detail: typeof body?.detail === "string" ? body.detail : null,
        });
      } else {
        setFailure({ error: cause instanceof Error ? cause.message : String(cause), detail: null });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace">
      <section className="content">
        <div className="page-dev">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{t("dev.title")}</p>
              <h1>{t("dev.heading")}</h1>
            </div>
          </div>
          <table className="dev-table">
            <thead>
              <tr>
                <th>{t("dev.colVersion")}</th>
                <th>{t("dev.colTitle")}</th>
                <th>{t("dev.colLang")}</th>
                <th>{t("dev.colItems")}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.courseVersionId}>
                  <td dir="auto">{course.courseVersionId}</td>
                  <td dir="auto">{course.title}</td>
                  <td>{course.languageCode}</td>
                  <td>{course.itemCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="upload-panel">
            <h2>{t("dev.uploadTitle")}</h2>
            <div className="upload-form">
              <input ref={fileRef} type="file" accept=".zip" />
              <button className="gold-button" type="button" disabled={busy} onClick={() => void upload()}>
                {busy ? t("dev.uploading") : t("dev.upload")}
              </button>
            </div>
            {failure && (
              <div className="upload-result upload-failure" role="alert">
                <strong>{t("dev.failed")}: {failure.error}</strong>
                {failure.detail && <p dir="auto">{failure.detail}</p>}
              </div>
            )}
            {result && (
              <div className="upload-result">
                <strong>{t("dev.imported")}</strong>
                <ul>
                  {result.imported.map((item) => (
                    <li key={item.courseVersionId} dir="auto">
                      {item.courseVersionId} — {item.title} / {item.languageCode} / {item.itemCount}
                      {item.reused && <em>（{t("dev.reused")}）</em>}
                    </li>
                  ))}
                </ul>
                {result.warnings.length > 0 && (
                  <>
                    <strong>{t("dev.warnings")}</strong>
                    <ul className="warning-list">
                      {result.warnings.map((warning, index) => (
                        <li key={index} dir="auto">{warning}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
