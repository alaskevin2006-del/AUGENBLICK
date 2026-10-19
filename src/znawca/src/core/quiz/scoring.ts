import type { AnswerEvaluation } from "./types";
import { normalizeText } from "./types";

const ANSWER_DELIMITER = /[;；,，]/u;

/**
 * Splits a user-submitted answer on any of the accepted separators:
 * half/full-width semicolon and half/full-width comma. Slashes, colons and
 * other symbols are deliberately NOT separators (D-02 boundary). Excel
 * parsing keeps using half-width semicolons only.
 */
export function splitAnswer(value: string): string[] {
  return value.split(ANSWER_DELIMITER).map((part) => part.trim()).filter(Boolean);
}

/**
 * D-20：把一个文本答案组说明按 `/` 拆成归一化别名集合。
 * `China/PRC` 表示一个必答组，提交 `China` 或 `PRC` 任一别名即覆盖该组。
 * 媒体路径答案（含协议或以媒体扩展名结尾，如 `znawca-media://asset/a.jpg`）
 * 本身含 `/` 但必须整体精确匹配，不参与别名拆分。
 */
const MEDIA_ANSWER = /\.(?:avif|bmp|gif|jpe?g|png|webp|mp3|wav|m4a|mp4|webm)$/iu;

function isAtomicAnswer(value: string): boolean {
  return value.includes("://") || MEDIA_ANSWER.test(value);
}

function aliasesOf(specifier: string): Set<string> {
  if (isAtomicAnswer(specifier)) return new Set([normalizeText(specifier)].filter((alias) => alias.length > 0));
  return new Set(
    specifier
      .split("/")
      .map(normalizeText)
      .filter((alias) => alias.length > 0),
  );
}

interface ExpectedGroup {
  /** 原始组说明（含别名写法），用于 matched/missed 展示。 */
  readonly specifier: string;
  /** 组内全部别名（归一化）。 */
  readonly aliases: ReadonlySet<string>;
}

function expectedGroups(expected: readonly string[]): ExpectedGroup[] {
  const groups: ExpectedGroup[] = [];
  const seen = new Set<string>();
  for (const value of expected) {
    const aliases = aliasesOf(value);
    if (aliases.size === 0) continue;
    // 别名集合相同的组说明视为同一必答组（顺序不同也不重复要求）。
    const signature = [...aliases].sort().join("\u0000");
    if (seen.has(signature)) continue;
    seen.add(signature);
    groups.push({ specifier: value.trim(), aliases });
  }
  return groups;
}

interface SubmittedToken {
  /** 原样提交串，用于 extra 展示。 */
  readonly token: string;
  /** 提交串按 `/` 展开的别名（提交 `China/PRC` 等价于提交了两个别名）。 */
  readonly aliases: ReadonlySet<string>;
}

function submittedTokens(submitted: string | readonly string[]): SubmittedToken[] {
  const parts = typeof submitted === "string" ? splitAnswer(submitted) : submitted;
  const byNormalized = new Map<string, SubmittedToken>();
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    const entry: SubmittedToken = { token, aliases: aliasesOf(token) };
    byNormalized.set(normalizeText(token), entry);
  }
  return [...byNormalized.values()];
}

export function evaluateAnswer(
  expected: readonly string[],
  submitted: string | readonly string[],
): AnswerEvaluation {
  const groups = expectedGroups(expected);
  const tokens = submittedTokens(submitted);
  const groupMatched = groups.map((group) =>
    tokens.some((entry) => [...entry.aliases].some((alias) => group.aliases.has(alias))),
  );
  const extra = tokens
    .filter((entry) => ![...entry.aliases].some((alias) => groups.some((group) => group.aliases.has(alias))))
    .map((entry) => entry.token);
  const matched = groups.filter((_, index) => groupMatched[index]).map((group) => group.specifier);
  const missed = groups.filter((_, index) => !groupMatched[index]).map((group) => group.specifier);
  const score = groups.length === 0 ? 0 : matched.length / groups.length;
  return {
    score,
    fullyCorrect: missed.length === 0 && extra.length === 0 && groups.length > 0,
    matched,
    missed,
    extra,
  };
}
