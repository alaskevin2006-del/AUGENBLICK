import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseVersionPayload } from "../datasource/payload";
import { courseFromPayload } from "../datasource/payload";
import { buildCourseQuestionSet } from "../core/quiz/question-set";
import { evaluateAnswer } from "../core/quiz/scoring";
import type { AnswerEvaluation, Question, RandomSource } from "../core/quiz/types";
import {
  LearningSessionController,
  TestingSessionController,
  type LearningSessionRecord,
  type SessionIdentity,
} from "../core/session";
import type { ProgressUnitCounts } from "../core/progress/knowledge-progress";
import { translate, type Locale } from "../core/localization";
import { InterfaceLangContext, SessionView, ResultsView, type ResultReviewEntry } from "../ui";

/** 契约§五：引擎发出的事件统一头。 */
export interface EngineEvent {
  readonly eventId: string;
  readonly seq: number;
  readonly ts: number;
  readonly type: string;
  readonly payload: unknown;
}

export interface ZnawcaActivityProps {
  readonly coursePayload: CourseVersionPayload;
  readonly mode: "L" | "T";
  readonly randomSeed: number;
  readonly itemCount: number | null;
  readonly resumeToken: unknown | null;
  /** 契约§十：引擎 UI 界面语言（ui 组件全部走 translate(interfaceLang, key)）。 */
  readonly interfaceLang: Locale;
  readonly onEvent: (event: EngineEvent, resumeToken?: unknown) => void;
  readonly onExit: () => void;
}

/**
 * resumeToken（引擎私有、后端不透明透传）：
 * - L 模式：LearningSessionRecord（controller save() 快照）+ seq/index；
 * - T 模式：{index}（确定性选题可重放）+ seq + 已作答记录（结果页回顾/总分用）。
 */
interface LearningResumeToken {
  readonly kind: "L";
  readonly seq: number;
  readonly index: number;
  readonly record: LearningSessionRecord;
}

interface TestingResolvedRecord {
  readonly question: Question;
  readonly evaluation: AnswerEvaluation;
  readonly submittedAnswers: readonly string[];
}

interface TestingResumeToken {
  readonly kind: "T";
  readonly seq: number;
  readonly index: number;
  readonly records: readonly TestingResolvedRecord[];
}

type ResumeToken = LearningResumeToken | TestingResumeToken;

/** mulberry32：确定性 PRNG，同一 randomSeed 重建同一题序（T 模式恢复依赖）。 */
function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random.next() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function isResumeToken(value: unknown): value is ResumeToken {
  return typeof value === "object" && value !== null && ((value as { kind?: unknown }).kind === "L" || (value as { kind?: unknown }).kind === "T");
}

interface ActivityResult {
  readonly totalScore: number;
  readonly answered: number;
  readonly fullyCorrect: number;
  readonly incorrect: number;
  readonly review: readonly ResultReviewEntry[];
}

/** 契约§五入口：注入界面语言 context 后挂载活动本体。 */
export function ZnawcaActivity(props: ZnawcaActivityProps) {
  return (
    <InterfaceLangContext.Provider value={props.interfaceLang}>
      <ZnawcaActivityView {...props} />
    </InterfaceLangContext.Provider>
  );
}

function ZnawcaActivityView(props: ZnawcaActivityProps) {
  // —— 初始化（确定性，StrictMode 下可重入：只做纯计算）——
  const init = useMemo(() => {
    const course = courseFromPayload(props.coursePayload);
    const token = isResumeToken(props.resumeToken) ? props.resumeToken : null;
    const identity: SessionIdentity = {
      id: props.coursePayload.attemptId ?? `${props.coursePayload.courseVersionId}:${props.randomSeed}`,
      courseId: course.id,
      courseTitle: course.title,
      startedAt: new Date().toISOString(),
      scope: {
        filters: [],
        selectedQuestionTypes: ["input", "choice"],
        requestedQuestionCount: props.itemCount ?? 0,
        teachingStyle: "strict",
        difficultFirst: false,
      },
    };
    if (props.mode === "L") {
      // L 模式：恢复快照优先；否则全池 seeded 洗牌（itemCount 截断）。
      if (token?.kind === "L") {
        return { course, token, learning: LearningSessionController.resume(token.record), testing: null as TestingSessionController | null, offset: token.index };
      }
      const pool = buildCourseQuestionSet({ course, teachingStyle: "strict", random: mulberry32(props.randomSeed) }).questions;
      const selected = shuffled(pool, mulberry32(props.randomSeed)).slice(0, props.itemCount ?? pool.length);
      return { course, token, learning: new LearningSessionController(identity, selected), testing: null, offset: 0 };
    }
    // T 模式：同一 seed 重建同一题序；恢复时按 {index} 续答。
    const pool = buildCourseQuestionSet({ course, teachingStyle: "strict", random: mulberry32(props.randomSeed) }).questions;
    const selected = shuffled(pool, mulberry32(props.randomSeed)).slice(0, props.itemCount ?? pool.length);
    const offset = token?.kind === "T" ? Math.min(token.index, selected.length) : 0;
    return { course, token, learning: null as LearningSessionController | null, testing: new TestingSessionController(identity, selected.slice(offset), 0), offset };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [question, setQuestion] = useState<Question | undefined>(() =>
    init.learning ? init.learning.current() : init.testing!.current(Date.now()),
  );
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerEvaluation | undefined>();
  const [needsAnother, setNeedsAnother] = useState(false);
  const [units, setUnits] = useState<ProgressUnitCounts | undefined>(() =>
    init.learning ? init.learning.progressUnits() : init.testing!.progressUnits(),
  );
  const [position, setPosition] = useState(init.offset + 1);
  const [result, setResult] = useState<ActivityResult | undefined>();

  const seqRef = useRef(init.token?.seq ?? 0);
  // index：已发 itemStarted/itemResolved 的序号（会话内递增，恢复时续上）。
  const indexRef = useRef(init.offset);
  const shownAtRef = useRef(Date.now());
  const encountersRef = useRef(new Map<string, number>());
  // T 模式恢复前的历史记录（结果页与总分并入）。
  const priorRecordsRef = useRef<readonly TestingResolvedRecord[]>(init.token?.kind === "T" ? init.token.records : []);
  const totalRef = useRef((() => {
    if (init.learning) {
      const progress = init.learning.save().progress;
      return progress.queue.length + progress.completedQuestionIds.length;
    }
    return init.testing!.summary().total + init.offset;
  })());

  const currentToken = (): ResumeToken => {
    if (init.learning) {
      return { kind: "L", seq: seqRef.current, index: indexRef.current, record: init.learning.save() };
    }
    const records = [
      ...priorRecordsRef.current,
      ...init.testing!.summary().records.map((record) => ({
        question: record.question,
        evaluation: record.evaluation,
        submittedAnswers: record.submittedAnswers,
      })),
    ];
    return { kind: "T", seq: seqRef.current, index: indexRef.current, records };
  };

  const emit = (type: string, payload: unknown): void => {
    seqRef.current += 1;
    props.onEvent(
      { eventId: crypto.randomUUID(), seq: seqRef.current, ts: Date.now(), type, payload },
      currentToken(),
    );
  };

  // 挂载时发 activityReady（全新会话）并为当前题发 itemStarted；严格幂等（防重挂重发）。
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!init.token) emit("activityReady", { itemCount: totalRef.current });
    if (question) {
      indexRef.current += 1;
      setPosition(indexRef.current);
      encountersRef.current.set(question.id, (encountersRef.current.get(question.id) ?? 0) + 1);
      shownAtRef.current = Date.now();
      emit("itemStarted", { index: indexRef.current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (resolved: readonly { question: Question; evaluation: AnswerEvaluation; submittedAnswers: readonly string[] }[]): void => {
    const answered = resolved.length;
    const totalScore = answered === 0 ? 0 : resolved.reduce((sum, entry) => sum + entry.evaluation.score, 0) / answered;
    const fullyCorrect = resolved.filter((entry) => entry.evaluation.fullyCorrect).length;
    emit("activityFinished", { totalScore, perItemDetail: [] });
    setResult({
      totalScore,
      answered,
      fullyCorrect,
      incorrect: answered - fullyCorrect,
      review: resolved.map((entry) => ({
        questionId: entry.question.id,
        prompt: entry.question.prompt,
        direction: entry.question.direction,
        submittedAnswers: entry.submittedAnswers,
        acceptedAnswers: entry.question.acceptedAnswers,
        options: entry.question.options,
      })),
    });
  };

  const submit = (): void => {
    if (!question || feedback || result) return;
    const evaluation = evaluateAnswer(question.acceptedAnswers, answer);
    const submitted = answer ? [answer] : [];
    let attemptNumber = 1;
    if (init.learning) {
      init.learning.answer(question.id, evaluation, undefined, submitted);
      // attemptNumber：该题在本次会话中的累计作答次数（重答递增）。
      attemptNumber = init.learning.records().filter((record) => record.questionId === question.id).length;
      setNeedsAnother(init.learning.save().progress.queue.some((entry) => entry.question.id === question.id));
      setUnits(init.learning.progressUnits());
    } else {
      init.testing!.submit(question.id, { evaluation, submittedAnswers: submitted }, Date.now());
      setUnits(init.testing!.progressUnits());
    }
    emit("itemResolved", {
      index: indexRef.current,
      score: evaluation.score,
      dimensions: [],
      attemptNumber,
      encounterNumber: encountersRef.current.get(question.id) ?? 1,
      elapsedMs: Math.max(0, Date.now() - shownAtRef.current),
    });
    setFeedback(evaluation);
  };

  const next = (): void => {
    if (!feedback || result) return;
    if (init.learning) {
      if (init.learning.isComplete()) {
        finish(init.learning.records().map((record) => ({
          question: record.question,
          evaluation: record.evaluation,
          submittedAnswers: record.submittedAnswers,
        })));
        return;
      }
      const current = init.learning.current();
      setQuestion(current);
      if (current) {
        indexRef.current += 1;
        setPosition(indexRef.current);
        encountersRef.current.set(current.id, (encountersRef.current.get(current.id) ?? 0) + 1);
        shownAtRef.current = Date.now();
        emit("itemStarted", { index: indexRef.current });
      }
    } else {
      if (init.testing!.isComplete()) {
        finish([
          ...priorRecordsRef.current,
          ...init.testing!.summary().records.map((record) => ({
            question: record.question,
            evaluation: record.evaluation,
            submittedAnswers: record.submittedAnswers,
          })),
        ]);
        return;
      }
      const current = init.testing!.current(Date.now());
      setQuestion(current);
      if (current) {
        indexRef.current += 1;
        setPosition(indexRef.current);
        encountersRef.current.set(current.id, (encountersRef.current.get(current.id) ?? 0) + 1);
        shownAtRef.current = Date.now();
        emit("itemStarted", { index: indexRef.current });
      }
    }
    setAnswer("");
    setFeedback(undefined);
    setNeedsAnother(false);
  };

  if (result) {
    return (
      <ResultsView
        totalScore={result.totalScore}
        answered={result.answered}
        fullyCorrect={result.fullyCorrect}
        incorrect={result.incorrect}
        mode={props.mode}
        review={result.review}
        onExit={props.onExit}
      />
    );
  }
  if (!question) {
    return (
      <div className="results-page">
        <h1>{translate(props.interfaceLang, "noQuestionsAvailable")}</h1>
        <div className="result-actions">
          <button className="gold-button" onClick={props.onExit}>{translate(props.interfaceLang, "back")}</button>
        </div>
      </div>
    );
  }
  return (
    <SessionView
      question={question}
      courseTitle={init.course.title}
      speechCourse={init.course}
      mode={props.mode}
      position={Math.min(position, totalRef.current)}
      total={totalRef.current}
      {...(units ? { units } : {})}
      answer={answer}
      setAnswer={setAnswer}
      {...(feedback ? { feedback } : {})}
      needsAnother={needsAnother}
      onSubmit={submit}
      onNext={next}
    />
  );
}
