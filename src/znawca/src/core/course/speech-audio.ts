import type { Course } from "./types";
import type { Question, QuestionOption } from "../quiz/types";

/**
 * D-22：分语言朗读目录 `speech/<lang>/` 的消费逻辑（纯函数，浏览器安全）。
 *
 * 坐标命名约定：普通单元格＝`列字母 + 行号`（如 `C4.mp3`，定位该单元格的
 * 文字朗读）；第 1 行双向标题（D-19 `正向 / 反向`）各配一段：
 * `C1-F.mp3`（正向题干）、`C1-R.mp3`（反向题干）。
 *
 * 朗读音频与内容媒体是两套用途：`course.speech`（主进程把 `speechFiles`
 * 转成 `znawca-media://` URL）缺失或不含所需坐标文件时静默跳过，
 * 不启用任何 TTS。
 */

/** Excel 列号（1 起）→ 列字母（A、B、…、Z、AA…）。 */
export function columnLetters(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function speechLookup(course: Course): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const asset of course.speech ?? []) {
    map.set(normalizeSpeechKey(asset.file), asset.url);
  }
  return map;
}

function normalizeSpeechKey(file: string): string {
  const trimmed = file.trim().toLowerCase();
  // 坐标键按去扩展名的文件主干匹配：`C4.mp3`/`C4.wav` 都命中坐标 `C4`。
  const dot = trimmed.lastIndexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

function lookup(map: ReadonlyMap<string, string>, stem: string | undefined): string | undefined {
  return stem ? map.get(normalizeSpeechKey(stem)) : undefined;
}

function cellSpeechFile(columnIndex: number, row: number): string {
  return `${columnLetters(columnIndex)}${row}`;
}

function headerSpeechFile(columnIndex: number, side: "F" | "R"): string {
  return `${columnLetters(columnIndex)}1-${side}`;
}

function fieldColumnIndex(course: Course, field: string | undefined): number | undefined {
  if (!field) return undefined;
  return course.columns.find((column) => column.title === field)?.index;
}

function itemByObjectId(course: Course, objectId: string) {
  return course.items.find((item) => item.id === objectId);
}

/**
 * D-22/D-23：当前题目的问题单元格朗读链，按界面显示顺序排列：
 * - `name-to-property`（正向）：名称单元格（B 列）→ 该属性列标题正向题干（`C1-F`）；
 * - `property-to-name`（反向）：属性单元格 → 该列标题反向题干（`C1-R`）；
 * - `name-to-image/audio/video`：名称单元格；
 * - 题目本身是图片/音频/视频（`question.media` 存在）时不自动朗读，返回空链。
 * 缺失对应朗读文件的片段被静默跳过；全部缺失时返回空链。
 */
export function speechAudioForQuestion(course: Course, question: Question): string[] {
  if (question.media) return [];
  const map = speechLookup(course);
  const item = itemByObjectId(course, question.objectId);
  if (!item) return [];
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  const urls: string[] = [];
  const push = (file: string | undefined): void => {
    const url = lookup(map, file);
    if (url) urls.push(url);
  };
  if (question.direction === "name-to-property") {
    push(cellSpeechFile(nameColumnIndex, item.sourceRow));
    const columnIndex = fieldColumnIndex(course, question.field);
    if (columnIndex !== undefined) push(headerSpeechFile(columnIndex, "F"));
  } else if (question.direction === "property-to-name") {
    const columnIndex = fieldColumnIndex(course, question.field);
    if (columnIndex !== undefined) {
      push(cellSpeechFile(columnIndex, item.sourceRow));
      push(headerSpeechFile(columnIndex, "R"));
    }
  } else if (question.direction.startsWith("name-to-")) {
    push(cellSpeechFile(nameColumnIndex, item.sourceRow));
  }
  return urls;
}

/**
 * D-22：反馈链中「正确答案」的文字朗读（V2 speech 坐标）。答案本身是可播放
 * 媒体（音频）时不朗读文字——feedback 的 answerAudioPath 会直接播放答案音频；
 * 图片/视频答案无声。其余文字答案按其来源单元格取坐标：
 * - `name-to-property`：该对象该属性列单元格（答案＝属性值）；
 * - `property-to-name` / `image-to-name` / `video-to-name`：名称列单元格（答案＝名称）。
 * `name-to-*`（答案为媒体）与 `audio-to-name`（答案音频已由媒体链覆盖）返回空链。
 * 缺失对应朗读文件时返回空链（调用方静默跳过，不启用 TTS）。
 */
export function speechAudioForAnswer(course: Course, question: Question): string[] {
  const map = speechLookup(course);
  const item = itemByObjectId(course, question.objectId);
  if (!item) return [];
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  if (question.direction === "name-to-property") {
    const columnIndex = fieldColumnIndex(course, question.field);
    if (columnIndex === undefined) return [];
    const url = lookup(map, cellSpeechFile(columnIndex, item.sourceRow));
    return url ? [url] : [];
  }
  if (question.direction === "property-to-name"
    || question.direction === "image-to-name"
    || question.direction === "video-to-name") {
    const url = lookup(map, cellSpeechFile(nameColumnIndex, item.sourceRow));
    return url ? [url] : [];
  }
  return [];
}

/**
 * D-22：文字答案按钮的手动朗读。媒体选项自身可播放，不提供朗读按钮；
 * 其余文字选项按其文本来源单元格取坐标：`name-to-property` 选项＝该对象
 * 该属性列单元格，其余方向的文字选项（名称）＝该对象名称列单元格。
 * 无对应朗读文件时返回 undefined（按钮不渲染）。
 */
export function speechAudioForOption(
  course: Course,
  question: Question,
  option: QuestionOption,
): string | undefined {
  if (option.media) return undefined;
  const map = speechLookup(course);
  const item = itemByObjectId(course, option.objectId);
  if (!item) return undefined;
  const nameColumnIndex = course.nameColumnIndex ?? 1;
  if (question.direction === "name-to-property") {
    const columnIndex = fieldColumnIndex(course, question.field);
    if (columnIndex === undefined) return undefined;
    return lookup(map, cellSpeechFile(columnIndex, item.sourceRow));
  }
  return lookup(map, cellSpeechFile(nameColumnIndex, item.sourceRow));
}
