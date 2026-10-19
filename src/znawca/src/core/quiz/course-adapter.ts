import type { Course, CourseIssue } from "../course/types";
import { applyFilters, findNonDiscriminatingFields } from "./filter";
import type { CourseObject, FilterSelection, MediaKind } from "./types";

/** D-19：列标题解析出的双向题干（首个 `/` 分隔，两侧必填）。 */
export interface BidirectionalStems {
  readonly forward: string;
  readonly reverse: string;
}

/**
 * D-19/D-21：列标题解析。标记约定顺序：`#`（筛选列，既有约定）→ `$`/`*`
 * （D-21 列角色：`$`＝仅作问题、`*`＝仅作答案）→ `正向题干 / 反向题干`
 * （D-19：首个 `/` 分隔两方向，`/` 在标题中是保留字符）。
 * 只有两侧均非空时才给出 `stems`。
 */
export function bidirectionalStems(title: string): BidirectionalStems | undefined {
  return parseColumnTitle(title).stems;
}

/** D-19：V2 双向表头不合法时的阻断错误，携带精确到标题单元格的 issues。 */
export class BidirectionalHeaderError extends Error {
  constructor(readonly issues: readonly CourseIssue[]) {
    super("Column headers must be 'forward stem / reverse stem' with both sides filled.");
    this.name = "BidirectionalHeaderError";
  }
}

/**
 * D-19：V2 课程所有非筛选列（含名称列 B）的标题必须是
 * 「正向题干 / 反向题干」；缺 `/` 或任一侧为空 → error 级 issue，
 * 位置精确到文件/工作表/标题单元格（第 1 行、列号）。V1 课程只读兼容，不校验。
 */
export function bidirectionalHeaderIssues(course: Course): CourseIssue[] {
  if (course.formatVersion !== "v2") return [];
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  const issues: CourseIssue[] = [];
  for (const column of course.columns) {
    if (column.filterOnly || column.index < nameColumnIndex) continue;
    const parsed = parseColumnTitle(column.title);
    const separator = parsed.displayTitle.indexOf("/");
    const location = {
      file: course.workbookPath,
      sheet: course.sheetName,
      row: 1,
      column: column.index,
      columnName: column.title,
    };
    if (separator < 0) {
      issues.push({
        severity: "error",
        code: "HEADER_BIDIRECTIONAL_MISSING",
        message: `Column header '${column.title}' is missing the '/' between the forward and reverse question stems.`,
        suggestion: "Write the header as 'forward stem / reverse stem', for example 'Capital / Country'.",
        location,
      });
    } else {
      const forward = parsed.displayTitle.slice(0, separator).trim();
      const reverse = parsed.displayTitle.slice(separator + 1).trim();
      if (!forward || !reverse) {
        issues.push({
          severity: "error",
          code: "HEADER_BIDIRECTIONAL_SIDE_EMPTY",
          message: `Column header '${column.title}' has an empty ${forward ? "reverse" : "forward"} question stem.`,
          suggestion: "Fill in both sides of the header: 'forward stem / reverse stem'.",
          location,
        });
      }
    }
  }
  return issues;
}

interface ParsedColumnTitle {
  readonly displayTitle: string;
  readonly filterOnly: boolean;
  readonly role?: "question-only" | "answer-only";
  readonly stems?: BidirectionalStems;
}

function parseColumnTitle(title: string): ParsedColumnTitle {
  let rest = title.trim();
  const filterOnly = rest.startsWith("#");
  if (filterOnly) rest = rest.slice(1).trim();
  let role: ParsedColumnTitle["role"];
  if (rest.startsWith("$")) {
    role = "question-only";
    rest = rest.slice(1).trim();
  } else if (rest.startsWith("*")) {
    role = "answer-only";
    rest = rest.slice(1).trim();
  }
  const separator = rest.indexOf("/");
  const forward = separator >= 0 ? rest.slice(0, separator).trim() : "";
  const reverse = separator >= 0 ? rest.slice(separator + 1).trim() : "";
  return {
    displayTitle: rest,
    filterOnly,
    ...(role ? { role } : {}),
    ...(forward && reverse ? { stems: { forward, reverse } } : {}),
  };
}

/**
 * D-21：列角色（表头 `$`/`*` 标记）。`question-only`＝仅作问题（只出以该列为
 * 题干的反向题），`answer-only`＝仅作答案（只出正向题）。未声明返回 undefined。
 */
export function columnRole(title: string): "question-only" | "answer-only" | undefined {
  return parseColumnTitle(title).role;
}

export function courseObjects(course: Course): CourseObject[] {
  const filterFields = new Set(course.columns.filter((column) => column.filterOnly).map((column) => column.title));
  return course.items.map((item) => {
    const attributes: Record<string, readonly string[]> = {};
    const filters: Record<string, readonly string[]> = {};
    for (const [field, values] of Object.entries(item.values)) {
      (filterFields.has(field) ? filters : attributes)[field] = values;
    }
    const media: Partial<Record<MediaKind, string[]>> = {};
    const mediaPaths = new Set<string>();
    const addMedia = (kind: MediaKind, path: string): void => {
      if (mediaPaths.has(path)) return;
      mediaPaths.add(path);
      (media[kind] ??= []).push(path);
    };
    for (const asset of item.media) addMedia(asset.kind, asset.path);
    // V2：属性单元格媒体（cellMedia）并入媒体池，供 name-to-media / media-to-name
    // 出题消费。纯媒体列的 attributes 为空，已被 skippedFields（无区分度）排除，
    // 不会同时产生该列的文字题。
    for (const assets of Object.values(item.cellMedia ?? {})) {
      for (const asset of assets) addMedia(asset.kind, asset.path);
    }
    return { id: item.id, name: item.name, attributes, filters, media };
  });
}

export function filterOptions(course: Course): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, string[]> = {};
  for (const column of course.columns.filter((entry) => entry.filterOnly)) {
    result[column.title] = [...new Set(course.items.flatMap((item) => item.values[column.title] ?? []))]
      .sort((left, right) => left.localeCompare(right));
  }
  return result;
}

export function filteredCourseObjects(course: Course, selections: readonly FilterSelection[]): CourseObject[] {
  return applyFilters(courseObjects(course), selections.filter((selection) => selection.values.length > 0));
}

export function skippedQuestionFields(course: Course, selections: readonly FilterSelection[]): string[] {
  const objects = filteredCourseObjects(course, selections);
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  const questionFields = course.columns
    .filter((column) => column.index > nameColumnIndex && !column.filterOnly)
    .map((column) => column.title);
  return findNonDiscriminatingFields(objects, questionFields);
}
