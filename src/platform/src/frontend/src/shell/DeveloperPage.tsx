import { useRef, useState } from "react";
import {AuthorTemplates} from '../engines/AuthorTemplates';
import {
  ApiError,
  type CourseSummary,
  type UploadProgress,
  type UploadResult,
} from "../orchestrator/types";
import { getBackend } from "../orchestrator/api";
import { validateUpload } from "../orchestrator/upload";
import { useT, type ShellKey } from "../i18n";
export function DeveloperPage({
  isDeveloper,
  courses,
  disabled,
  onUploaded,
  onPreview,
  onPublish,
  onUnpublish,
}: {
  readonly isDeveloper: boolean;
  readonly courses: readonly CourseSummary[];
  readonly disabled?: boolean;
  readonly onUploaded: () => Promise<void> | void;
  readonly onPreview: (id: string) => void;
  readonly onUnpublish: (id: string) => void;
  readonly onPublish: (id: string) => void;
}) {
  const t = useT();
  const lock = useRef(false);
  const [withdraw, setWithdraw] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [failure, setFailure] = useState<{
    key: ShellKey;
    status?: number;
    detail?: string;
  } | null>(null);
  if (!isDeveloper) return <p role="alert">{t("dev.forbidden")}</p>;
  const upload = async () => {
    if (lock.current) return;
    setFailure(null);
    setResult(null);
    if (!file) {
      setFailure({ key: "dev.noFile" });
      return;
    }
    const invalid = validateUpload(file);
    if (invalid) {
      setFailure({ key: invalid });
      return;
    }
    lock.current = true;
    setBusy(true);
    setProgress({ phase: "uploading", percent: 0 });
    try {
      const backend = await getBackend();
      const uploaded = await backend.uploadCourse(file, setProgress);
      setResult(uploaded);
      setFile(null);
      await onUploaded();
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: unknown; detail?: unknown } | null;
        const detail = [body?.error, body?.detail]
          .filter((v): v is string => typeof v === "string")
          .join(" · ");
        setFailure({
          key:
            error.status === 413
              ? "upload.tooLarge"
              : error.status === 0
                ? "upload.network"
                : error.status === 408 || error.status === 504
                  ? "upload.timeout"
                  : "upload.rejected",
          status: error.status,
          ...(detail ? { detail } : {}),
        });
      } else setFailure({ key: "upload.network" });
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  };
  return (
    <div className="workspace">
      <section className="content">
        <div className="page-dev">
          <div className="page-heading">
            <h1>{t("dev.heading")}</h1>
            <div className="upload-form">
              <input
                type="file"
                accept=".zip"
                aria-label={t("dev.uploadTitle")}
                disabled={busy || disabled}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setFailure(null);
                  setResult(null);
                  event.target.value = "";
                }}
              />
              <button
                className="gold-button"
                disabled={busy || disabled}
                onClick={() => void upload()}
              >
                {t(busy ? "dev.uploading" : "dev.upload")}
              </button>
            </div>
          </div>
          <AuthorTemplates/>
          {file && (
            <p className="selected-file" dir="auto">
              {file.name}
            </p>
          )}
          {progress && (
            <div role="status" className="upload-status">
              <p>
                {progress.phase === "processing"
                  ? t("upload.processing")
                  : t("upload.progress", { percent: progress.percent })}
              </p>
              <progress
                max={100}
                value={progress.percent}
                aria-label={t("dev.uploading")}
              />
            </div>
          )}
          {failure && (
            <div className="inline-error" role="alert">
              <p>{t(failure.key, { status: failure.status ?? 0 })}</p>
              {failure.detail && <p dir="auto">{failure.detail}</p>}
            </div>
          )}
          {result && (
            <div className="upload-result" role="status">
              <strong>{t("upload.success")}</strong>
              <ul>
                {result.imported.map((item) => (
                  <li key={item.courseVersionId} dir="auto">
                    {item.title}
                  </li>
                ))}
              </ul>
              {result.warnings.length > 0 && (
                <>
                  <strong>{t("dev.warnings")}</strong>
                  <ul>
                    {result.warnings.map((warning, index) => (
                      <li key={index} dir="auto">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="table-scroll">
            <table className="dev-table">
              <thead>
                <tr>
                  <th>{t("dev.colTitle")}</th>
                  <th>{t("dev.status")}</th>
                  <th>{t("dev.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.courseVersionId}>
                    <td dir="auto">{course.title}</td>
                    <td>
                      <span
                        className={`course-status ${course.status ?? "draft"}`}
                      >
                        {t(
                          course.status === "published"
                            ? "dev.published"
                            : "dev.draft",
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="course-actions">
                        <button className="metal-button" disabled={busy || disabled || course.engine !== "znawca"} onClick={() => onPreview(course.courseVersionId)}>{t("courses.enter")}</button>
                        {course.status === "published" && <button className="metal-button" disabled={busy || disabled} onClick={() => setWithdraw(course.courseVersionId)}>{t("dev.unpublish")}</button>}
                        {course.status !== "published" && (
                          <button
                            className="gold-button"
                            disabled={busy || disabled}
                            onClick={() => onPublish(course.courseVersionId)}
                          >
                            {t("dev.publish")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {courses.length === 0 && <p>{t("courses.empty")}</p>}
          {withdraw && <div className="dialog-backdrop"><section className="host-dialog" role="dialog" aria-modal="true" aria-label={t("dev.unpublish")}><h2 dir="auto">{courses.find(c => c.courseVersionId === withdraw)?.title}</h2><p>{t("dev.unpublishConfirm")}</p><div className="course-actions"><button className="metal-button" onClick={() => setWithdraw(null)}>{t("setup.cancel")}</button><button className="gold-button" disabled={busy || disabled} onClick={() => {onUnpublish(withdraw); setWithdraw(null);}}>{t("dev.unpublish")}</button></div></section></div>}
          <p className="page-note">{t("dev.note")}</p>
        </div>
      </section>
    </div>
  );
}
