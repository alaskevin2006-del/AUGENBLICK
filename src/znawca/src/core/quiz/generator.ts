import {
  CourseObject,
  MediaKind,
  Question,
  QuestionDirection,
  QuestionOption,
  RandomSource,
  TeachingStyle,
  mathRandomSource,
  normalizeText,
} from "./types";
import { bidirectionalStems } from "./course-adapter";

export interface GenerateQuestionRequest {
  readonly target: CourseObject;
  readonly field?: string;
  readonly direction: QuestionDirection;
  readonly requestedKind: "input" | "choice";
  readonly filteredObjects: readonly CourseObject[];
  readonly allCourseObjects: readonly CourseObject[];
  readonly teachingStyle: TeachingStyle;
  readonly random?: RandomSource;
  readonly recentMediaPaths?: readonly string[];
}

function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random.next() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function mediaKind(direction: QuestionDirection): MediaKind | undefined {
  if (direction.includes("image")) return "image";
  if (direction.includes("audio")) return "audio";
  if (direction.includes("video")) return "video";
  return undefined;
}

function pickMedia(
  object: CourseObject,
  kind: MediaKind,
  random: RandomSource,
  recentMediaPaths: readonly string[] = [],
): string | undefined {
  const paths = object.media?.[kind] ?? [];
  if (!paths.length) return undefined;
  const recent = new Set(recentMediaPaths);
  const fresh = paths.filter((path) => !recent.has(path));
  const candidates = fresh.length ? fresh : paths;
  return candidates[Math.floor(random.next() * candidates.length)];
}

function answerFor(object: CourseObject, field: string | undefined, direction: QuestionDirection): readonly string[] {
  if (direction.endsWith("to-name")) return [object.name];
  if (direction === "name-to-property" && field) return object.attributes[field] ?? [];
  const kind = mediaKind(direction);
  if (kind && direction.startsWith("name-to-")) return object.media?.[kind] ?? [];
  if (field) return object.attributes[field] ?? [];
  return [];
}

function promptFor(object: CourseObject, field: string | undefined, direction: QuestionDirection): string {
  // D-19：带 `/` 的双向表头给出每个方向各自的题干；无 `/`（V1 兼容）沿用旧行为。
  const stems = field ? bidirectionalStems(field) : undefined;
  if (direction === "name-to-property") return `${object.name} / ${stems ? stems.forward : field ?? ""}`;
  if (direction === "property-to-name") {
    const values = (object.attributes[field ?? ""] ?? []).join("; ");
    return stems ? `${values} / ${stems.reverse}` : values;
  }
  if (direction.startsWith("name-to-")) return object.name;
  return "Identify the object";
}

function optionValue(
  object: CourseObject,
  field: string | undefined,
  direction: QuestionDirection,
  random: RandomSource,
  recentMediaPaths: readonly string[] = [],
): string | undefined {
  if (direction.endsWith("to-name")) return object.name;
  if (direction === "name-to-property" && field) return object.attributes[field]?.join("; ");
  const kind = mediaKind(direction);
  if (kind && direction.startsWith("name-to-")) return pickMedia(object, kind, random, recentMediaPaths);
  return undefined;
}

function questionOption(
  object: CourseObject,
  value: string,
  direction: QuestionDirection,
): QuestionOption {
  const key = normalizeText(value);
  const kind = mediaKind(direction);
  return {
    id: `${object.id}:${key}`,
    label: value,
    value,
    objectId: object.id,
    ...(kind && direction.startsWith("name-to-") ? { media: { kind, path: value } } : {}),
  };
}

export function generateQuestion(request: GenerateQuestionRequest): Question {
  const random = request.random ?? mathRandomSource;
  const kind = mediaKind(request.direction);
  const acceptedAnswers = answerFor(request.target, request.field, request.direction);
  if (acceptedAnswers.length === 0) {
    throw new QuestionGenerationError(
      kind ? "The selected object has no media for this question." : "The selected object has no answer for this question.",
      kind ? "MISSING_MEDIA" : "MISSING_ANSWER",
    );
  }
  if (request.direction === "property-to-name" && !hasUniqueReverseAnswer(request)) {
    throw new QuestionGenerationError("The selected property value matches more than one object.", "AMBIGUOUS_REVERSE_QUESTION");
  }
  const questionMedia = kind && request.direction.endsWith("to-name")
    ? pickMedia(request.target, kind, random, request.recentMediaPaths)
    : undefined;
  if (kind && request.direction.endsWith("to-name") && !questionMedia) {
    throw new QuestionGenerationError("The selected object has no media for this question.", "MISSING_MEDIA");
  }
  const base = {
    id: `${request.target.id}:${request.field ?? kind ?? "name"}:${request.direction}:${request.requestedKind}`,
    objectId: request.target.id,
    direction: request.direction,
    prompt: promptFor(request.target, request.field, request.direction),
    field: request.field,
    acceptedAnswers,
    ...(questionMedia ? { media: { kind: kind!, path: questionMedia } } : {}),
  } as const;

  if (request.requestedKind === "input") {
    if (kind && request.direction.startsWith("name-to-")) {
      const fallbackMedia = pickMedia(request.target, kind, random, request.recentMediaPaths);
      return {
        ...base,
        id: `${request.target.id}:${kind}:${kind}-to-name:input:from-name-to-media`,
        kind: "input",
        direction: `${kind}-to-name` as QuestionDirection,
        prompt: "Identify the object",
        acceptedAnswers: [request.target.name],
        ...(fallbackMedia ? { media: { kind, path: fallbackMedia } } : {}),
        degradationReason: "insufficient-distractors",
      };
    }
    return { ...base, kind: "input" };
  }

  const source = request.teachingStyle === "strict" ? request.filteredObjects : request.allCourseObjects;
  const correctValue = optionValue(request.target, request.field, request.direction, random, request.recentMediaPaths);
  const correctKey = correctValue ? normalizeText(correctValue) : "";
  const correct: QuestionOption | undefined = correctValue
    ? questionOption(request.target, correctValue, request.direction)
    : undefined;
  const uniqueDistractors = new Map<string, QuestionOption>();
  for (const object of shuffled(source, random)) {
    // An object's other media must never become an option against itself.
    if (object.id === request.target.id) continue;
    const value = optionValue(object, request.field, request.direction, random, request.recentMediaPaths);
    if (!value) continue;
    const key = normalizeText(value);
    if (key === correctKey || uniqueDistractors.has(key)) continue;
    uniqueDistractors.set(key, questionOption(object, value, request.direction));
  }
  const distractors = [...uniqueDistractors.values()];
  const optionCount = distractors.length >= 3 ? 4 : distractors.length >= 2 ? 3 : 0;
  if (!correct || optionCount === 0) {
    if (kind && request.direction.startsWith("name-to-")) {
      const fallbackMedia = pickMedia(request.target, kind, random, request.recentMediaPaths);
      const fallbackDirection = `${kind}-to-name` as QuestionDirection;
      return {
        ...base,
        id: `${request.target.id}:${kind}:${fallbackDirection}:input:degraded`,
        kind: "input",
        direction: fallbackDirection,
        prompt: "Identify the object",
        acceptedAnswers: [request.target.name],
        ...(fallbackMedia ? { media: { kind, path: fallbackMedia } } : {}),
        degradationReason: "insufficient-distractors",
      };
    }
    return { ...base, kind: "input", degradationReason: "insufficient-distractors" };
  }
  const options = shuffled([correct, ...distractors.slice(0, optionCount - 1)], random);
  return {
    ...base,
    kind: "choice",
    options,
    ...(kind && request.direction.startsWith("name-to-") ? { acceptedAnswers: [correct.value] } : {}),
  };
}

export class QuestionGenerationError extends Error {
  constructor(
    message: string,
    readonly code: "AMBIGUOUS_REVERSE_QUESTION" | "MISSING_ANSWER" | "MISSING_MEDIA",
  ) {
    super(message);
  }
}

function hasUniqueReverseAnswer(request: GenerateQuestionRequest): boolean {
  const field = request.field;
  if (!field) return false;
  const targetSignature = (request.target.attributes[field] ?? []).map(normalizeText).sort().join("\u0000");
  if (!targetSignature) return false;
  const source = request.teachingStyle === "strict" ? request.filteredObjects : request.allCourseObjects;
  return source.filter((object) =>
    (object.attributes[field] ?? []).map(normalizeText).sort().join("\u0000") === targetSignature
  ).length === 1;
}
