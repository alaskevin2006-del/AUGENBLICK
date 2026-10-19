import { useState } from "react";
import type { QuestionDirection } from "../core/quiz/types";
import { AnswerValues } from "./Session";
import { textDirection, useInterfaceLang, useInterfaceT } from "./interface-lang";

/** 结果页回顾条目：引擎适配器从答题记录整理后传入。 */
export interface ResultReviewEntry {
  readonly questionId: string;
  readonly prompt: string;
  readonly direction: QuestionDirection;
  readonly submittedAnswers: readonly string[];
  readonly acceptedAnswers: readonly string[];
  readonly options?: import("../core/quiz/types").Question["options"];
}

export interface ResultsViewProps {
  /** 归一化总分 0–1。 */
  readonly totalScore: number;
  readonly answered: number;
  readonly fullyCorrect: number;
  readonly incorrect: number;
  readonly mode: "L" | "T";
  readonly review: readonly ResultReviewEntry[];
  readonly onExit: () => void;
}

function answerMediaKind(direction: QuestionDirection): "image" | "audio" | "video" | undefined {
  if (direction === "name-to-image") return "image";
  if (direction === "name-to-audio") return "audio";
  if (direction === "name-to-video") return "video";
  return undefined;
}

/** 结果页：复用桌面 Results 的勋章/回顾风格。 */
export function ResultsView(props: ResultsViewProps) {
  const t = useInterfaceT();
  const lang = useInterfaceLang();
  const [reviewOpen, setReviewOpen] = useState(false);
  const percentage = Math.round(props.totalScore * 100);
  return (
    <div className="results-page" dir={textDirection(lang)}>
      <p className="eyebrow">{t("sessionComplete").toUpperCase()}</p>
      <div className="score-medallion">
        <strong>{percentage}%</strong>
        <span>{props.fullyCorrect} / {props.answered} {t("points")}</span>
      </div>
      <div className="result-stats">
        <span>{t("correctCount")} {props.fullyCorrect}</span>
        <span>{t("incorrectCount")} {props.incorrect}</span>
      </div>
      <h1>{percentage === 100 ? t("flawless") : t("progressWorth")}</h1>
      {props.review.length > 0 && (
        <button className="metal-button" onClick={() => setReviewOpen((open) => !open)}>{t("reviewAnswers")}</button>
      )}
      {reviewOpen && (
        <div className="answer-review">
          {props.review.map((entry, index) => (
            <article key={`${entry.questionId}-${index}`}>
              <strong dir="auto">{entry.prompt}</strong>
              <span>
                {t("submittedAnswer")}:{" "}
                {entry.submittedAnswers.length > 0 ? (
                  <AnswerValues
                    values={entry.submittedAnswers}
                    {...(answerMediaKind(entry.direction) ? { mediaKind: answerMediaKind(entry.direction) } : {})}
                    options={entry.options}
                    plain
                  />
                ) : t("noAnswer")}
              </span>
              <span>
                {t("correctAnswer")}:{" "}
                <AnswerValues
                  values={entry.acceptedAnswers}
                  {...(answerMediaKind(entry.direction) ? { mediaKind: answerMediaKind(entry.direction) } : {})}
                  options={entry.options}
                  plain
                />
              </span>
            </article>
          ))}
        </div>
      )}
      <div className="result-actions">
        <button className="gold-button" onClick={props.onExit}>{t("courses")}</button>
      </div>
    </div>
  );
}
