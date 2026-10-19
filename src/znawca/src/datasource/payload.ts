import type { Course, CourseColumn, CourseItem, MediaAsset, MediaKind } from "../core/course/types";

/**
 * 契约§二：CourseVersion payload（后端编译产物，唯一运行时来源）。
 * 前端不解析 xlsx、不扫目录；媒体字段均为可直接播放的 URL。
 */
export interface PayloadColumn {
  readonly index: number;
  readonly title: string;
  readonly filterOnly: boolean;
  readonly role?: "both" | "question-only" | "answer-only";
  readonly forward?: string;
  readonly reverse?: string;
}

export interface PayloadMediaRef {
  readonly kind: MediaKind;
  readonly url: string;
}

export interface PayloadItem {
  readonly id: string;
  readonly name: string;
  readonly sourceRow: number;
  readonly values: Readonly<Record<string, readonly string[]>>;
  readonly media?: readonly PayloadMediaRef[];
  readonly cellMedia?: Readonly<Record<string, readonly PayloadMediaRef[]>>;
}

export interface PayloadSpeechRef {
  readonly coord: string;
  readonly url: string;
}

export interface CourseVersionPayload {
  readonly schemaVersion: string;
  readonly engine: "znawca";
  readonly courseVersionId: string;
  readonly title: string;
  readonly languageCode?: string;
  readonly formatVersion?: "v1" | "v2";
  readonly nameColumnIndex?: number;
  readonly columns: readonly PayloadColumn[];
  readonly items: readonly PayloadItem[];
  readonly speech?: readonly PayloadSpeechRef[];
  readonly feedbackSounds?: { readonly correct: readonly string[]; readonly incorrect: readonly string[] };
  /** 编排器在创建会话后随 payload 下发（契约§三）；缺省时由适配器用固定种子。 */
  readonly randomSeed?: number;
  readonly attemptId?: string;
}

function extensionOf(url: string): string {
  const clean = url.split(/[?#]/u)[0] ?? "";
  const dot = clean.lastIndexOf(".");
  return dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

function toAsset(ref: PayloadMediaRef, source: MediaAsset["source"]): MediaAsset {
  return { kind: ref.kind, path: ref.url, extension: extensionOf(ref.url), source };
}

/** 契约§二 payload → core Course（buildCourseQuestionSet / session 直接消费）。 */
export function courseFromPayload(payload: CourseVersionPayload): Course {
  const columns: CourseColumn[] = payload.columns.map((column) => ({
    index: column.index,
    title: column.title,
    displayTitle: column.title,
    filterOnly: column.filterOnly,
  }));
  const items: CourseItem[] = payload.items.map((item) => ({
    id: item.id,
    name: item.name,
    sourceRow: item.sourceRow,
    values: item.values,
    media: (item.media ?? []).map((ref) => toAsset(ref, "standard")),
    cellMedia: Object.fromEntries(
      Object.entries(item.cellMedia ?? {}).map(([field, refs]) => [
        field,
        refs.map((ref) => toAsset(ref, "cell")),
      ]),
    ),
  }));
  return {
    id: payload.courseVersionId,
    title: payload.title,
    displayTitle: payload.title,
    ...(payload.languageCode ? { languageCode: payload.languageCode } : {}),
    formatVersion: payload.formatVersion ?? "v2",
    nameColumnIndex: payload.nameColumnIndex ?? 2,
    directory: "",
    workbookPath: "",
    sheetName: "",
    columns,
    items,
    // speech 坐标（如 "B2"）作为 file 传入：core 的 speechLookup 按去扩展名主干匹配。
    speech: (payload.speech ?? []).map((ref) => ({ file: ref.coord, url: ref.url })),
    ...(payload.feedbackSounds ? { feedbackSounds: payload.feedbackSounds } : {}),
  };
}
