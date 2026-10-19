import type { AnswerEvaluation, Question } from "../core/quiz/types";
export type PublicQuestion = Omit<Question, "acceptedAnswers" | "options"> & {
  readonly speechUrls?: readonly string[];
  readonly options?: readonly (NonNullable<Question["options"]>[number] & {readonly speechUrl?: string})[];
};
export interface RuntimeFeedback extends AnswerEvaluation { readonly submissionId: string; readonly correctAnswers: readonly string[]; readonly needsAnother?: boolean; }
export interface RuntimeSnapshot {
  readonly isPreview?: boolean;
  readonly sessionId: string;
  readonly courseVersionId: string;
  readonly mode: "L" | "T";
  readonly status: "active" | "finished" | "cancelled" | "skipped";
  readonly totalScore: number | null;
  readonly question: PublicQuestion | null;
  readonly feedback: RuntimeFeedback | null;
  readonly progress: {readonly total: number; readonly completed: number; readonly remaining: number};
  readonly canFinish: boolean;
  readonly canSkip: boolean;
  readonly review: readonly {readonly question: PublicQuestion; readonly answer: string; readonly feedback: RuntimeFeedback}[];
}
export interface AnswerRequest { readonly submissionId: string; readonly questionId: string; readonly answer: string; }
export interface RuntimeApi {
  answer(sessionId: string, request: AnswerRequest): Promise<RuntimeSnapshot>;
  advance(sessionId: string, action: "next" | "finish" | "skip", questionId?: string, submissionId?: string): Promise<RuntimeSnapshot>;
}
