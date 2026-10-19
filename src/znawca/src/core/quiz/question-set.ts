import type { Course } from "../course/types";
import {
  bidirectionalHeaderIssues,
  BidirectionalHeaderError,
  columnRole,
  courseObjects,
  filteredCourseObjects,
  skippedQuestionFields,
} from "./course-adapter";
import { generateQuestion, QuestionGenerationError } from "./generator";
import type {
  FilterSelection,
  MediaKind,
  Question,
  QuestionDirection,
  QuestionKind,
  RandomSource,
  SkippedQuestion,
  TeachingStyle,
} from "./types";

export interface BuildCourseQuestionSetRequest {
  readonly course: Course;
  readonly selections?: readonly FilterSelection[];
  readonly teachingStyle: TeachingStyle;
  readonly directions?: readonly QuestionDirection[];
  readonly requestedKinds?: readonly QuestionKind[];
  readonly random?: RandomSource;
  readonly recentMediaPaths?: readonly string[];
}

export interface QuestionAvailability {
  readonly generated: number;
  readonly input: number;
  readonly choice: number;
  readonly degraded: number;
  readonly skipped: number;
  readonly byDirection: Readonly<Partial<Record<QuestionDirection, number>>>;
}

export interface CourseQuestionSet {
  readonly questions: readonly Question[];
  readonly skipped: readonly SkippedQuestion[];
  readonly skippedFields: readonly string[];
  readonly availability: QuestionAvailability;
}

const allDirections: readonly QuestionDirection[] = [
  "name-to-property",
  "property-to-name",
  "image-to-name",
  "name-to-image",
  "audio-to-name",
  "name-to-audio",
  "video-to-name",
  "name-to-video",
];

const mediaKinds: readonly MediaKind[] = ["image", "audio", "video"];

/**
 * Builds the complete, currently valid question pool for a renderer or session.
 * Every question is produced by generateQuestion, so strict/lenient distractors,
 * ambiguity checks and choice degradation have one source of truth.
 */
export function buildCourseQuestionSet(request: BuildCourseQuestionSetRequest): CourseQuestionSet {
  // D-19：V2 双向表头缺失或任一侧为空 → 阻断出题并携带精确位置（导入侧由
  // loader 接线同一校验；此处是 quiz 层的兜底阻断）。
  const headerIssues = bidirectionalHeaderIssues(request.course);
  if (headerIssues.length > 0) throw new BidirectionalHeaderError(headerIssues);
  const selections = request.selections ?? [];
  const directions = new Set(request.directions ?? allDirections);
  const requestedKinds = request.requestedKinds ?? ["input", "choice"];
  const allObjects = courseObjects(request.course);
  const filteredObjects = filteredCourseObjects(request.course, selections);
  const skippedFields = new Set(skippedQuestionFields(request.course, selections));
  const nameColumnIndex = request.course.nameColumnIndex ?? 1;
  const questionColumns = request.course.columns
    .filter((column) => column.index > nameColumnIndex && !column.filterOnly && !skippedFields.has(column.title));
  const questions: Question[] = [];
  const skipped: SkippedQuestion[] = [];

  const add = (
    targetId: string,
    direction: QuestionDirection,
    requestedKind: QuestionKind,
    field?: string,
  ) => {
    const target = filteredObjects.find((object) => object.id === targetId);
    if (!target) return;
    try {
      const question = generateQuestion({
        target,
        ...(field ? { field } : {}),
        direction,
        requestedKind,
        filteredObjects,
        allCourseObjects: allObjects,
        teachingStyle: request.teachingStyle,
        ...(request.random ? { random: request.random } : {}),
        ...(request.recentMediaPaths ? { recentMediaPaths: request.recentMediaPaths } : {}),
      });
      questions.push({ ...question, id: `${request.course.id}:${question.id}` });
    } catch (error) {
      if (!(error instanceof QuestionGenerationError)) throw error;
      skipped.push({
        objectId: target.id,
        ...(field ? { field } : {}),
        direction,
        requestedKind,
        reason: skipReason(error.code),
      });
    }
  };

  for (const target of filteredObjects) {
    for (const column of questionColumns) {
      // D-21：`$`＝仅作问题（只出反向题）、`*`＝仅作答案（只出正向题）；
      // 未声明角色的列不受影响；不替代 D-01 的歧义反向题跳过。
      const role = columnRole(column.title);
      for (const direction of ["name-to-property", "property-to-name"] as const) {
        if (!directions.has(direction)) continue;
        if (direction === "name-to-property" && role === "question-only") continue;
        if (direction === "property-to-name" && role === "answer-only") continue;
        for (const kind of requestedKinds) add(target.id, direction, kind, column.title);
      }
    }
    for (const mediaKind of mediaKinds) {
      const toName = `${mediaKind}-to-name` as QuestionDirection;
      const fromName = `name-to-${mediaKind}` as QuestionDirection;
      if (directions.has(toName)) {
        for (const kind of requestedKinds) add(target.id, toName, kind);
      }
      // A name-to-media prompt is meaningful as a media choice. Its input
      // fallback is already represented by media-to-name input.
      if (directions.has(fromName) && requestedKinds.includes("choice")) add(target.id, fromName, "choice");
    }
  }

  return {
    questions,
    skipped,
    skippedFields: [...skippedFields],
    availability: availability(questions, skipped),
  };
}

function skipReason(code: QuestionGenerationError["code"]): SkippedQuestion["reason"] {
  if (code === "AMBIGUOUS_REVERSE_QUESTION") return "ambiguous-reverse-question";
  if (code === "MISSING_MEDIA") return "missing-media";
  return "missing-answer";
}

function availability(
  questions: readonly Question[],
  skipped: readonly SkippedQuestion[],
): QuestionAvailability {
  const byDirection: Partial<Record<QuestionDirection, number>> = {};
  for (const question of questions) {
    byDirection[question.direction] = (byDirection[question.direction] ?? 0) + 1;
  }
  return {
    generated: questions.length,
    input: questions.filter((question) => question.kind === "input").length,
    choice: questions.filter((question) => question.kind === "choice").length,
    degraded: questions.filter((question) => question.degradationReason).length,
    skipped: skipped.length,
    byDirection,
  };
}
