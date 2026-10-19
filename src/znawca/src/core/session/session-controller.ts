import type { FilterSelection, Question, TeachingStyle } from "../quiz/types";
import type { ProgressUnitCounts } from "../progress/knowledge-progress";
import type { LearningAnswerRecord, LearningSnapshot } from "./learning-session";
import { LearningSession } from "./learning-session";
import type { PerQuestionTimerSeconds, TestAnswerRecord, TestSummary, TestSubmission } from "./testing-session";
import { TestingSession } from "./testing-session";

export interface SessionScope {
  readonly filters: readonly FilterSelection[];
  readonly selectedQuestionTypes: readonly string[];
  readonly requestedQuestionCount: number;
  readonly teachingStyle: TeachingStyle;
  readonly difficultFirst: boolean;
}

export interface LearningSessionRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly startedAt: string;
  readonly savedAt: string;
  readonly scope: SessionScope;
  readonly progress: LearningSnapshot;
}

export interface LearningHistoryRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly scope: SessionScope;
  readonly questionCount: number;
  readonly attemptCount: number;
  readonly records: readonly LearningAnswerRecord[];
}

export interface TestHistoryRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly scope: SessionScope;
  readonly timerSeconds: PerQuestionTimerSeconds;
  readonly summary: TestSummary;
}

export interface SessionIdentity {
  readonly id: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly startedAt: string;
  readonly scope: SessionScope;
}

export class LearningSessionController {
  private readonly session: LearningSession;

  constructor(
    private readonly identity: SessionIdentity,
    questionsOrRecord: readonly Question[] | LearningSessionRecord,
  ) {
    this.session = new LearningSession(
      isLearningRecord(questionsOrRecord) ? questionsOrRecord.progress : questionsOrRecord,
    );
  }

  current(): Question | undefined { return this.session.current(); }

  answer(
    questionId: string,
    evaluation: Parameters<LearningSession["answer"]>[1],
    answeredAt?: string,
    submittedAnswers?: readonly string[],
  ): void {
    this.session.answer(questionId, evaluation, answeredAt, submittedAnswers);
  }

  isComplete(): boolean { return this.session.isComplete(); }

  /** D-24：Learning 进度单位统计（总数开始时固定，重试不增）。 */
  progressUnits(): ProgressUnitCounts { return this.session.progressUnits(); }

  records(): readonly LearningAnswerRecord[] { return this.session.snapshot().records ?? []; }

  save(savedAt = new Date().toISOString()): LearningSessionRecord {
    return {
      schemaVersion: 1,
      ...this.identity,
      savedAt,
      progress: this.session.snapshot(),
    };
  }

  history(completedAt = new Date().toISOString()): LearningHistoryRecord {
    if (!this.session.isComplete()) throw new Error("Cannot create learning history before the session is complete.");
    const progress = this.session.snapshot();
    return {
      schemaVersion: 1,
      ...this.identity,
      completedAt,
      questionCount: progress.completedQuestionIds.length,
      attemptCount: progress.records?.length ?? 0,
      records: [...(progress.records ?? [])],
    };
  }

  static resume(record: LearningSessionRecord): LearningSessionController {
    return new LearningSessionController(record, record);
  }
}

export class TestingSessionController {
  private readonly session: TestingSession;

  constructor(
    private readonly identity: SessionIdentity,
    questions: readonly Question[],
    readonly timerSeconds: PerQuestionTimerSeconds,
  ) {
    this.session = new TestingSession(questions, timerSeconds);
  }

  current(nowMs: number): Question | undefined { return this.session.current(nowMs); }
  remainingMs(nowMs: number): number | undefined { return this.session.remainingMs(nowMs); }
  submit(questionId: string, submission: TestSubmission, nowMs: number): TestAnswerRecord {
    return this.session.submit(questionId, submission, nowMs);
  }
  expire(nowMs: number): TestAnswerRecord | undefined { return this.session.expire(nowMs); }
  isComplete(): boolean { return this.session.isComplete(); }
  summary(): TestSummary { return this.session.summary(); }

  /** D-24：Testing 进度单位统计（总数/已完成/剩余）。 */
  progressUnits(): ProgressUnitCounts { return this.session.progressUnits(); }

  history(completedAt = new Date().toISOString()): TestHistoryRecord {
    if (!this.session.isComplete()) throw new Error("Cannot create test history before the test is complete.");
    return {
      schemaVersion: 1,
      ...this.identity,
      completedAt,
      timerSeconds: this.timerSeconds,
      summary: this.session.summary(),
    };
  }
}

function isLearningRecord(value: readonly Question[] | LearningSessionRecord): value is LearningSessionRecord {
  return !Array.isArray(value);
}
