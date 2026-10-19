import type { AnswerEvaluation, Question, RandomSource } from "../quiz/types";
import { DifficultyMemory, weightedSampleByObject, type DifficultyRecord, type DifficultyScope } from "../difficulty/difficulty-memory";

export interface KnowledgeProjectScope {
  readonly courseId: string;
  readonly objectId: string;
  readonly projectId: string;
}

export interface KnowledgeProgressRecord extends KnowledgeProjectScope {
  readonly exposureCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly mastered: boolean;
  readonly lastSeenAt: string;
  readonly lastTestedAt?: string;
  readonly seenQuestionIds: readonly string[];
  readonly seenMediaPaths: readonly string[];
}

export interface KnowledgeAttempt {
  readonly question: Question;
  readonly evaluation: AnswerEvaluation;
  readonly answeredAt?: string;
}

export interface SessionSelection {
  readonly questions: readonly Question[];
  readonly eligibleProjects: number;
  readonly coveredProjects: number;
  readonly masteredProjects: number;
  readonly unseenProjects: number;
}

export function projectIdForQuestion(question: Question): string {
  if (question.field) return `field:${question.field}`;
  const mediaKind = mediaKindForQuestion(question);
  return mediaKind ? `media:${mediaKind}` : "object";
}

/**
 * D-24：一个「名称＋学习单元格」关系的稳定单位键。
 * 同一对象的同一学习单元格（属性列或 A 列媒体类别）共享一个键：
 * 正反向、input/choice 题型、`/` 媒体变体全部归并为一个进度单位。
 */
export function progressUnitKey(question: Question): string {
  return `${question.objectId}\u0000${projectIdForQuestion(question)}`;
}

/** D-24：会话进度统计（总数在开始时固定，已完成＝达到移除/作答条件的单位数）。 */
export interface ProgressUnitCounts {
  readonly total: number;
  readonly completed: number;
  readonly remaining: number;
}

/**
 * D-24：一组题目覆盖的进度单位总数。
 * 只统计真实生成的题目——空单元格（MISSING_ANSWER）、缺失/损坏媒体（MISSING_MEDIA）
 * 与无区分度列（skippedFields）在出题阶段已被跳过，天然不进入这里；重试不改变总数。
 */
export function progressUnitTotal(questions: readonly Question[]): number {
  return new Set(questions.map(progressUnitKey)).size;
}

export function projectLabel(projectId: string): string {
  if (projectId.startsWith("field:")) return projectId.slice("field:".length);
  if (projectId.startsWith("media:")) {
    const kind = projectId.slice("media:".length);
    return kind === "image" ? "图片" : kind === "audio" ? "音频" : kind === "video" ? "视频" : kind;
  }
  return "待诊断";
}

export function updateKnowledgeProgress(
  current: readonly KnowledgeProgressRecord[],
  courseId: string,
  attempts: readonly KnowledgeAttempt[],
  mode: "learning" | "testing",
  completedAt = new Date().toISOString(),
): KnowledgeProgressRecord[] {
  const records = new Map(current.map((record) => [scopeKey(record), record]));
  const grouped = new Map<string, KnowledgeAttempt[]>();
  for (const attempt of attempts) {
    const scope = scopeForQuestion(courseId, attempt.question);
    const key = scopeKey(scope);
    grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
  }

  for (const sessionAttempts of grouped.values()) {
    const question = sessionAttempts[0]!.question;
    const scope = scopeForQuestion(courseId, question);
    const key = scopeKey(scope);
    const previous = records.get(key);
    const correctCount = sessionAttempts.filter((attempt) => attempt.evaluation.fullyCorrect).length;
    const incorrectCount = sessionAttempts.length - correctCount;
    const seenQuestionIds = unique([
      ...(previous?.seenQuestionIds ?? []),
      ...sessionAttempts.map((attempt) => attempt.question.id),
    ]);
    const seenMediaPaths = unique([
      ...(previous?.seenMediaPaths ?? []),
      ...sessionAttempts.flatMap((attempt) => targetMediaPaths(attempt.question)),
    ]);
    records.set(key, {
      ...scope,
      exposureCount: (previous?.exposureCount ?? 0) + sessionAttempts.length,
      correctCount: (previous?.correctCount ?? 0) + correctCount,
      incorrectCount: (previous?.incorrectCount ?? 0) + incorrectCount,
      // Completing a learning queue means the selected project eventually met
      // its learning criterion. Tests may reveal difficulty without erasing the
      // fact that the material has already been learned.
      mastered: previous?.mastered === true || (mode === "learning" && sessionAttempts.at(-1)?.evaluation.fullyCorrect === true),
      lastSeenAt: sessionAttempts.at(-1)?.answeredAt ?? completedAt,
      ...(mode === "testing" ? { lastTestedAt: sessionAttempts.at(-1)?.answeredAt ?? completedAt } :
        previous?.lastTestedAt ? { lastTestedAt: previous.lastTestedAt } : {}),
      seenQuestionIds,
      seenMediaPaths,
    });
  }
  return [...records.values()];
}

export function selectLearningQuestions(
  questions: readonly Question[],
  count: number,
  courseId: string,
  progress: readonly KnowledgeProgressRecord[],
  difficulty: readonly DifficultyRecord[],
  difficultFirst: boolean,
  random: RandomSource,
): SessionSelection {
  const groups = projectGroups(questions, courseId);
  const progressMap = new Map(progress.map((record) => [scopeKey(record), record]));
  const limit = Math.min(Math.max(0, count), groups.length);
  const ordered = difficultFirst
    ? balanceObjects(
        weightedSampleByObject(groups, limit, (group) => objectScope(group.scope), new DifficultyMemory(difficulty), random),
        random,
      )
    : balanceObjects(
        rankGroups(groups, (group) => {
          const record = progressMap.get(scopeKey(group.scope));
          if (!record) return 10_000;
          if (!record.mastered) return 5_000 - record.exposureCount;
          return -dateRank(record.lastSeenAt);
        }, random).slice(0, limit),
        random,
      );
  return selectionSummary(groups, ordered.map((group) =>
    chooseVariant(group.questions, progressMap.get(scopeKey(group.scope)), random)), progressMap);
}

export function selectTestingQuestions(
  questions: readonly Question[],
  count: number,
  courseId: string,
  progress: readonly KnowledgeProgressRecord[],
  difficulty: readonly DifficultyRecord[],
  difficultFirst: boolean,
  random: RandomSource,
): SessionSelection {
  const allGroups = projectGroups(questions, courseId);
  const progressMap = new Map(progress.map((record) => [scopeKey(record), record]));
  const limit = Math.min(Math.max(0, count), allGroups.length);
  const ordered = difficultFirst
    ? balanceObjects(
        weightedSampleByObject(allGroups, limit, (group) => objectScope(group.scope), new DifficultyMemory(difficulty), random),
        random,
      )
    : balanceObjects(
        rankGroups(allGroups, (group) => -dateRank(progressMap.get(scopeKey(group.scope))?.lastTestedAt), random).slice(0, limit),
        random,
      );
  return selectionSummary(allGroups, ordered.map((group) =>
    chooseVariant(group.questions, progressMap.get(scopeKey(group.scope)), random)), progressMap);
}

export function progressSummary(
  questions: readonly Question[],
  courseId: string,
  progress: readonly KnowledgeProgressRecord[],
): Omit<SessionSelection, "questions"> {
  const groups = projectGroups(questions, courseId);
  const progressMap = new Map(progress.map((record) => [scopeKey(record), record]));
  return {
    eligibleProjects: groups.length,
    coveredProjects: groups.filter((group) => progressMap.has(scopeKey(group.scope))).length,
    masteredProjects: groups.filter((group) => progressMap.get(scopeKey(group.scope))?.mastered).length,
    unseenProjects: groups.filter((group) => !progressMap.has(scopeKey(group.scope))).length,
  };
}

function scopeForQuestion(courseId: string, question: Question): KnowledgeProjectScope {
  return { courseId, objectId: question.objectId, projectId: projectIdForQuestion(question) };
}

function objectScope(scope: KnowledgeProjectScope): DifficultyScope {
  return { courseId: scope.courseId, objectId: scope.objectId };
}

function projectGroups(questions: readonly Question[], courseId: string) {
  const groups = new Map<string, { scope: KnowledgeProjectScope; questions: Question[] }>();
  for (const question of questions) {
    const scope = scopeForQuestion(courseId, question);
    const key = scopeKey(scope);
    const group = groups.get(key) ?? { scope, questions: [] };
    group.questions.push(question);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function chooseVariant(
  questions: readonly Question[],
  progress: KnowledgeProgressRecord | undefined,
  random: RandomSource,
): Question {
  const unseen = questions.filter((question) => !progress?.seenQuestionIds.includes(question.id));
  const candidates = unseen.length ? unseen : questions;
  return candidates[Math.min(candidates.length - 1, Math.floor(random.next() * candidates.length))]!;
}

function rankGroups<T>(values: readonly T[], score: (value: T) => number, random: RandomSource): T[] {
  return values
    .map((value) => ({ value, score: score(value), tie: random.next() }))
    .sort((left, right) => right.score - left.score || left.tie - right.tie)
    .map((entry) => entry.value);
}

function balanceObjects<T extends { scope: KnowledgeProjectScope }>(values: readonly T[], random: RandomSource): T[] {
  const remaining = [...values];
  const result: T[] = [];
  let previousObjectId: string | undefined;
  while (remaining.length) {
    const alternatives = remaining
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value.scope.objectId !== previousObjectId);
    const candidates = alternatives.length ? alternatives : remaining.map((value, index) => ({ value, index }));
    const picked = candidates[Math.min(candidates.length - 1, Math.floor(random.next() * candidates.length))]!;
    result.push(remaining.splice(picked.index, 1)[0]!);
    previousObjectId = picked.value.scope.objectId;
  }
  return result;
}

function selectionSummary(
  allGroups: ReturnType<typeof projectGroups>,
  questions: readonly Question[],
  progressMap: ReadonlyMap<string, KnowledgeProgressRecord>,
  eligibleProjects = allGroups.length,
): SessionSelection {
  return {
    questions,
    eligibleProjects,
    coveredProjects: allGroups.filter((group) => progressMap.has(scopeKey(group.scope))).length,
    masteredProjects: allGroups.filter((group) => progressMap.get(scopeKey(group.scope))?.mastered).length,
    unseenProjects: allGroups.filter((group) => !progressMap.has(scopeKey(group.scope))).length,
  };
}

function targetMediaPaths(question: Question): string[] {
  if (question.media?.path) return [question.media.path];
  if (question.direction.startsWith("name-to-")) {
    return question.acceptedAnswers.filter((answer) => /\.(?:avif|bmp|gif|jpe?g|png|webp|mp3|wav|m4a|mp4|webm)$/iu.test(answer));
  }
  return [];
}

function mediaKindForQuestion(question: Question): "image" | "audio" | "video" | undefined {
  if (question.direction.includes("image")) return "image";
  if (question.direction.includes("audio")) return "audio";
  if (question.direction.includes("video")) return "video";
  return question.media?.kind;
}

function dateRank(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function scopeKey(scope: KnowledgeProjectScope): string {
  return JSON.stringify([scope.courseId, scope.objectId, scope.projectId]);
}
