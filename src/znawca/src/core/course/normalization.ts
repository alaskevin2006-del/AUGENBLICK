const WHITESPACE = /\s+/gu;

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(WHITESPACE, " ");
}

export function normalizeKey(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase("und");
}

export function splitValues(value: string): readonly string[] {
  return value
    .split(";")
    .map(normalizeWhitespace)
    .filter((part) => part.length > 0);
}

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

export function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/iu.exec(reference)?.[0]?.toUpperCase();
  if (!letters) return 0;
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result;
}
