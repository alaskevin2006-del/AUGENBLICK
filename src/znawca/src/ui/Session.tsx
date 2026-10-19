import { useMemo, useState } from "react";
import type { Course } from "../core/course/types";
import { speechAudioForOption, speechAudioForQuestion } from "../core/course/speech-audio";
import type { MessageKey } from "../core/localization";
import { textDirection, useInterfaceLang, useInterfaceT } from "./interface-lang";
import type {
  AnswerEvaluation,
  MediaKind,
  Question,
  QuestionDirection,
  QuestionOption,
} from "../core/quiz/types";
import type { ProgressUnitCounts } from "../core/progress/knowledge-progress";

const directionLabels: ReadonlyArray<[QuestionDirection, MessageKey]> = [
  ["name-to-property", "nameToProperty"],
  ["property-to-name", "propertyToName"],
  ["image-to-name", "imageToName"],
  ["name-to-image", "nameToImage"],
  ["audio-to-name", "audioToName"],
  ["name-to-audio", "nameToAudio"],
  ["video-to-name", "videoToName"],
  ["name-to-video", "nameToVideo"],
];

/** 播放一串朗读/提示音 URL（降级实现：单个 Audio 串行播放，失败静默跳过）。 */
export function playAudioChain(urls: readonly string[]): void {
  if (urls.length === 0) return;
  const audio = new Audio(urls[0]);
  audio.onended = () => playAudioChain(urls.slice(1));
  audio.onerror = () => playAudioChain(urls.slice(1));
  void audio.play().catch(() => playAudioChain(urls.slice(1)));
}

// D-11/D-25：纯媒体选项 3~4 项时启用 2×2 网格（判定与桌面一致）。
export function isMediaGridOptions(question: Question): boolean {
  return (
    question.kind === "choice" &&
    question.options !== undefined &&
    question.options.length >= 3 &&
    question.options.length <= 4 &&
    question.options.every((option) => option.media !== undefined)
  );
}

function promptText(question: Question, t: (key: MessageKey) => string): string {
  return question.direction === "image-to-name" ||
    question.direction === "audio-to-name" ||
    question.direction === "video-to-name"
    ? t("promptMedia")
    : question.prompt;
}

function answerMediaKind(direction: QuestionDirection): MediaKind | undefined {
  if (direction === "name-to-image") return "image";
  if (direction === "name-to-audio") return "audio";
  if (direction === "name-to-video") return "video";
  return undefined;
}

export function SpeechButton({ onPlay }: { onPlay(): void }) {
  const t = useInterfaceT();
  const label = t("playNarration");
  return (
    <button
      type="button"
      className="speech-button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPlay();
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
        <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z" fill="currentColor" />
        <path d="M14 3.23v2.06c3.39.49 6 3.39 6 6.71s-2.61 6.22-6 6.71v2.06c4.5-.52 8-4.26 8-8.77s-3.5-8.25-8-8.77z" fill="currentColor" />
      </svg>
    </button>
  );
}

export function QuestionMedia({ media }: { media: { kind: MediaKind; path: string } }) {
  const t = useInterfaceT();
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="question-media media-error" role="status">{t("mediaUnavailable")}</div>;
  if (media.kind === "image") {
    return (
      <div className="question-media">
        <img src={media.path} alt={t("identifyObject")} onError={() => setFailed(true)} />
      </div>
    );
  }
  if (media.kind === "audio") {
    return (
      <div className="question-media">
        <audio src={media.path} controls aria-label={t("identifyObject")} onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className="question-media">
      <video src={media.path} controls aria-label={t("identifyObject")} onError={() => setFailed(true)} />
    </div>
  );
}

/** 渲染一串答案值：媒体题渲染媒体，文字题渲染文本（沿用桌面 AnswerValues 语义）。 */
export function AnswerValues({
  values,
  mediaKind,
  plain,
  options,
}: {
  values: readonly string[];
  mediaKind?: MediaKind;
  plain?: boolean;
  options?: readonly QuestionOption[];
}) {
  if (mediaKind && mediaKind !== "image") {
    return (
      <div className="feedback-media-av">
        {values.map((path) => {
          const index = options?.findIndex((option) => option.value === path) ?? -1;
          return (
            <div key={path} className="feedback-media-av-item">
              {index >= 0 && <span className="feedback-option-index">{index + 1}</span>}
              <QuestionMedia media={{ kind: mediaKind, path }} />
            </div>
          );
        })}
      </div>
    );
  }
  if (mediaKind) {
    return (
      <div className="feedback-media">
        {values.map((path) => <QuestionMedia key={path} media={{ kind: mediaKind, path }} />)}
      </div>
    );
  }
  if (plain) return <>{values.join("; ")}</>;
  return <bdi>{values.join("; ")}</bdi>;
}

function QuestionChoice({
  option,
  index,
  selected,
  speechUrl,
  onSelect,
}: {
  option: QuestionOption;
  index: number;
  selected: boolean;
  speechUrl?: string;
  onSelect(): void;
}) {
  const t = useInterfaceT();
  return (
    <label>
      <input
        type="radio"
        name="answer"
        value={option.value}
        checked={selected}
        onChange={onSelect}
        aria-label={option.media ? `${t("selectMedia")} ${index + 1}` : option.label}
      />
      {option.media ? (
        <>
          <QuestionMedia media={option.media} />
          <span>{index + 1}</span>
        </>
      ) : (
        <span dir="auto">{option.label}</span>
      )}
      {!option.media && speechUrl && <SpeechButton onPlay={() => playAudioChain([speechUrl])} />}
    </label>
  );
}

function FeedbackDetails({ evaluation, question }: { evaluation: AnswerEvaluation; question: Question }) {
  const t = useInterfaceT();
  const mediaKind = answerMediaKind(question.direction);
  const render = (values: readonly string[]) =>
    values.length > 0 ? (
      <AnswerValues values={values} {...(mediaKind ? { mediaKind } : {})} options={question.options} />
    ) : null;
  return (
    <div className="feedback-details">
      {evaluation.matched.length > 0 && <span>{t("matchedAnswers")}: {render(evaluation.matched)}</span>}
      {evaluation.extra.length > 0 && <span>{t("extraAnswers")}: {render(evaluation.extra)}</span>}
    </div>
  );
}

export interface SessionViewProps {
  readonly question: Question & {
    readonly speechUrls?: readonly string[];
    readonly options?: readonly (QuestionOption & {readonly speechUrl?: string})[];
  };
  readonly courseTitle: string;
  readonly speechCourse?: Course;
  readonly disabled?: boolean;
  readonly nextLabel?: string;
  readonly mode: "L" | "T";
  readonly position: number;
  readonly total: number;
  readonly units?: ProgressUnitCounts;
  readonly answer: string;
  readonly setAnswer: (value: string) => void;
  readonly feedback?: AnswerEvaluation;
  readonly needsAnother: boolean;
  readonly onSubmit: () => void;
  readonly onNext: () => void;
}

export function SessionView(props: SessionViewProps) {
  const t = useInterfaceT();
  const lang = useInterfaceLang();
  const { question } = props;
  const correct = props.feedback?.fullyCorrect;
  const directionLabel = directionLabels.find(([direction]) => direction === question.direction)?.[1];
  // D-22：文字题的问题朗读链与文字选项的手动朗读（无 speech 资源时为空链/不渲染按钮）。
  const questionSpeech = useMemo(
    () => question.speechUrls ?? (question.media || !props.speechCourse ? [] : speechAudioForQuestion(props.speechCourse, question)),
    [props.speechCourse, question],
  );
  const optionSpeechUrl = (option: QuestionOption & {readonly speechUrl?: string}): string | undefined =>
    option.speechUrl ?? (props.speechCourse ? speechAudioForOption(props.speechCourse, question, option) : undefined);
  const units = props.units;
  return (
    <div className="session-page" dir={textDirection(lang)}>
      <header className="session-header">
        <div>
          <p>{props.courseTitle} / {t(props.mode === "L" ? "learning" : "testing")}</p>
          {props.mode === "L" && units ? (
            <strong>{units.completed} / {units.total} {t("masteredCount")}</strong>
          ) : (
            <strong>{t("question")} {props.position} {t("of")} {props.total}</strong>
          )}
          {units && (
            <span className="unit-progress">
              {units.completed} / {units.total} {t("unitsLabel")} · {units.remaining} {t("unitsRemaining")}
            </span>
          )}
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={units ? units.total : props.total}
          aria-valuenow={units ? units.completed : props.position}
          aria-label={t("progress")}
        >
          <span style={{ width: `${Math.min(100, (units ? units.completed / Math.max(1, units.total) : props.position / Math.max(1, props.total)) * 100)}%` }} />
        </div>
      </header>
      <article className={`question-card${isMediaGridOptions(question) ? " media-grid-card" : ""}`}>
        <p className="section-label">{directionLabel ? t(directionLabel).toUpperCase() : question.direction.toUpperCase()}</p>
        <div className="question-heading">
          <h1 dir="auto">{promptText(question, t)}</h1>
          {!question.media && questionSpeech.length > 0 && <SpeechButton onPlay={() => playAudioChain(questionSpeech)} />}
        </div>
        {question.media && <QuestionMedia key={question.media.path} media={question.media} />}
        {question.kind === "choice" ? (
          <fieldset className={`choice-list${isMediaGridOptions(question) ? " media-grid" : ""}`} disabled={props.disabled || Boolean(props.feedback)}>
            <legend>{t("yourAnswer")}</legend>
            {question.options?.map((option, index) => (
              <QuestionChoice
                key={option.id}
                option={option}
                index={index}
                selected={props.answer === option.value}
                speechUrl={optionSpeechUrl(option)}
                onSelect={() => props.setAnswer(option.value)}
              />
            ))}
          </fieldset>
        ) : (
          <label className="answer-box">
            <span>{t("yourAnswer")}</span>
            <input
              dir="auto"
              autoFocus
              value={props.answer}
              onChange={(event) => props.setAnswer(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && props.onSubmit()}
              placeholder={t("yourAnswer")}
              disabled={props.disabled || Boolean(props.feedback)}
            />
          </label>
        )}
        {props.feedback && (
          <div className={`feedback ${correct ? "correct" : "incorrect"}`}>
            <strong>{t(correct ? "correct" : "notQuite")}</strong>
            <span>
              {correct ? (
                props.mode === "L" && props.needsAnother ? t("correctAgain") : t("mastered")
              ) : (
                <>
                  {t("correctAnswer")}:{" "}
                  <AnswerValues
                    values={question.acceptedAnswers}
                    {...(answerMediaKind(question.direction) ? { mediaKind: answerMediaKind(question.direction) } : {})}
                    options={question.options}
                  />
                </>
              )}
            </span>
            {!correct && <FeedbackDetails evaluation={props.feedback} question={question} />}
          </div>
        )}
        <div className="question-actions">
          {!props.feedback ? (
            <button className="gold-button" disabled={props.disabled} onClick={props.onSubmit}>{t("checkAnswer")}</button>
          ) : (
            <button className="gold-button" disabled={props.disabled} onClick={props.onNext}>{props.nextLabel ?? t("nextQuestion")}</button>
          )}
        </div>
      </article>
    </div>
  );
}
