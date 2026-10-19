import { useT } from "../i18n";

/** 平台结果页：活动完成后展示后端权威 totalScore（与引擎内结果页衔接）。 */
export function ResultsPage({
  courseTitle,
  totalScore,
  onBack,
}: {
  readonly courseTitle: string;
  readonly totalScore: number | null;
  readonly onBack: () => void;
}) {
  const t = useT();
  const percentage = totalScore === null ? null : Math.round(totalScore * 100);
  return (
    <div className="workspace">
      <section className="content">
        <div className="results-page">
          <p className="eyebrow">{t("results.eyebrow")}</p>
          <div className="score-medallion">
            <strong>{percentage === null ? "—" : `${percentage}%`}</strong>
            <span dir="auto">{courseTitle}</span>
          </div>
          <h1>{percentage === 100 ? t("results.flawless") : t("results.progress")}</h1>
          <div className="result-actions">
            <button className="gold-button" onClick={onBack}>{t("results.back")}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
