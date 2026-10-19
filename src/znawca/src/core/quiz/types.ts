export type QuestionDirection =
  | "name-to-property"
  | "property-to-name"
  | "image-to-name"
  | "name-to-image"
  | "audio-to-name"
  | "name-to-audio"
  | "video-to-name"
  | "name-to-video";

export type MediaKind = "image" | "audio" | "video";
export type QuestionKind = "input" | "choice";
export type TeachingStyle = "strict" | "lenient";

export interface CourseObject {
  readonly id: string;
  readonly name: string;
  readonly attributes: Readonly<Record<string, readonly string[]>>;
  readonly filters?: Readonly<Record<string, readonly string[]>>;
  readonly media?: Partial<Readonly<Record<MediaKind, readonly string[]>>>;
}

export interface FilterSelection {
  readonly field: string;
  readonly values: readonly string[];
}

export interface QuestionOption {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly objectId: string;
  readonly media?: { readonly kind: MediaKind; readonly path: string };
}

export interface Question {
  readonly id: string;
  readonly objectId: string;
  readonly kind: QuestionKind;
  readonly direction: QuestionDirection;
  readonly prompt: string;
  readonly field?: string;
  readonly media?: { readonly kind: MediaKind; readonly path: string };
  readonly acceptedAnswers: readonly string[];
  readonly options?: readonly QuestionOption[];
  readonly degradationReason?: "insufficient-distractors";
}

export type QuestionSkipReason =
  | "ambiguous-reverse-question"
  | "missing-answer"
  | "missing-media";

export interface SkippedQuestion {
  readonly objectId: string;
  readonly field?: string;
  readonly direction: QuestionDirection;
  readonly requestedKind: QuestionKind;
  readonly reason: QuestionSkipReason;
}

export interface AnswerEvaluation {
  readonly score: number;
  readonly fullyCorrect: boolean;
  readonly matched: readonly string[];
  readonly missed: readonly string[];
  readonly extra: readonly string[];
}

export interface RandomSource {
  next(): number;
}

export const mathRandomSource: RandomSource = { next: () => Math.random() };

const SUBSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4",
  "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9",
};

export function normalizeText(value: string): string {
  let normalized = value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
  // Chemical formulas often use subscript digits that users cannot type
  // easily. Only subscript digits are folded; superscripts and any other
  // character remain exact (no general NFKC).
  if (/[\u2080-\u2089]/u.test(normalized)) {
    normalized = normalized.replace(/[\u2080-\u2089]/gu, (char) => SUBSCRIPT_DIGITS[char] ?? char);
  }
  return normalized;
}
