/**
 * V2 多语言工作簿命名解析（D-16）。
 *
 * 客户约定：课程目录内同一课程的多语言工作簿使用「基础名 + 语言后缀」命名，
 * 例如 `Birds_Eng.xlsx`、`Birds_Ru.xlsx`。语言后缀是 2~3 个 ASCII 字母。
 *
 * 本模块只做文件名解析，不猜测版本；是否按 V2 多语言处理由 loader 决定
 * （目录内全部工作簿均为同基础名的语言后缀时触发，单个语言工作簿也算）。
 */

export interface LanguageWorkbookName {
  /** 基础名，例如 `Birds`。 */
  readonly base: string;
  /** 语言代码，例如 `Eng`。 */
  readonly language: string;
}

const LANGUAGE_SUFFIX = /^(.+?)_([A-Za-z]{2,3})$/u;

/** 去掉 .xlsx 扩展名。 */
function stemOf(fileName: string): string {
  return fileName.replace(/\.xlsx$/iu, "");
}

/**
 * 解析语言后缀工作簿名。`Birds_Eng.xlsx` → `{ base: "Birds", language: "Eng" }`。
 * 不匹配（无下划线、语言码非 2~3 字母、含数字等）返回 undefined。
 */
export function parseLanguageWorkbookName(fileName: string): LanguageWorkbookName | undefined {
  const match = LANGUAGE_SUFFIX.exec(stemOf(fileName));
  if (!match) return undefined;
  const base = match[1].trim();
  const language = match[2];
  if (base.length === 0) return undefined;
  return { base, language };
}
