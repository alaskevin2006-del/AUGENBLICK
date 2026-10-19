import type { RandomSource } from "../quiz/types";

export interface DifficultyScope {
  readonly courseId: string;
  readonly objectId: string;
}

export interface DifficultyRecord extends DifficultyScope {
  readonly consecutiveCorrect: number;
}

export interface DifficultyAttempt extends DifficultyScope {
  readonly score: number;
  /**
   * Whether the answer was fully correct. When present it wins over the
   * score-based fallback so a multi-part answer that happens to score 1.0
   * (matched every part but also submitted extras) is not treated as fully
   * correct. Old callers that only carry score keep the legacy behavior.
   */
  readonly fullyCorrect?: boolean;
}

const DIFFICULT_WEIGHT = 2.0;
const NORMAL_WEIGHT = 1.0;
/**
 * An object leaves the difficulty list after two completed sessions in which
 * it actually appeared and was fully correct each time. Sessions where the
 * object did not appear do not count; any error by the object resets the
 * counter to zero.
 */
const CONSECUTIVE_TO_RECOVER = 2;

/**
 * DifficultyMemory keeps a simple binary difficulty list keyed by course +
 * object row (D-10). Attributes, media kinds, directions and question types
 * are intentionally collapsed into a single object-level record.
 *
 * Each completed session is summarized once per object: any not-fully-correct
 * answer makes the object difficult and resets recovery to zero; a session in
 * which every answer for the object was fully correct advances recovery by
 * exactly one (not by the number of attempts).
 */
export class DifficultyMemory {
  private readonly records = new Map<string, DifficultyRecord>();

  constructor(records: readonly DifficultyRecord[] = []) {
    for (const record of records) {
      if (!record.courseId || !record.objectId) continue;
      this.records.set(scopeKey(record), { ...record });
    }
  }

  completeSession(attempts: readonly DifficultyAttempt[]): void {
    const grouped = new Map<string, DifficultyAttempt[]>();
    for (const attempt of attempts) {
      const key = scopeKey(attempt);
      grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
    }
    for (const sessionAttempts of grouped.values()) {
      const scope = sessionAttempts[0]!;
      const key = scopeKey(scope);
      const previous = this.records.get(key);

      const allCorrect = sessionAttempts.every((a) => fullyCorrectOf(a));
      if (!allCorrect) {
        // Any error this session makes the object difficult and resets recovery.
        this.records.set(key, {
          courseId: scope.courseId,
          objectId: scope.objectId,
          consecutiveCorrect: 0,
        });
        continue;
      }

      // Fully correct but never difficult before: nothing to record.
      if (!previous) continue;

      const total = previous.consecutiveCorrect + 1;
      if (total >= CONSECUTIVE_TO_RECOVER) {
        this.records.delete(key);
      } else {
        this.records.set(key, { ...previous, consecutiveCorrect: total });
      }
    }
  }

  get(courseId: string, objectId: string): DifficultyRecord | undefined {
    const record = this.records.get(scopeKey({ courseId, objectId }));
    return record ? { ...record } : undefined;
  }

  isDifficult(courseId: string, objectId: string): boolean {
    return this.records.has(scopeKey({ courseId, objectId }));
  }

  selectionWeight(courseId: string, objectId: string): number {
    return this.isDifficult(courseId, objectId) ? DIFFICULT_WEIGHT : NORMAL_WEIGHT;
  }

  remove(scope: DifficultyScope): void {
    this.records.delete(scopeKey(scope));
  }

  snapshot(): readonly DifficultyRecord[] {
    return [...this.records.values()].map((r) => ({ ...r }));
  }
}

/**
 * Selects questions in object rounds. Each eligible object can contribute at
 * most one question per round; after an object is chosen, one of its remaining
 * question variants is selected uniformly. This prevents objects with more
 * attributes or question types from receiving an accidental probability boost.
 */
export function weightedSampleByObject<T>(
  values: readonly T[],
  count: number,
  scopeOf: (value: T) => DifficultyScope,
  memory: DifficultyMemory,
  random: RandomSource,
): T[] {
  const groups = new Map<string, { scope: DifficultyScope; values: T[] }>();
  for (const value of values) {
    const scope = scopeOf(value);
    const key = scopeKey(scope);
    const group = groups.get(key) ?? { scope, values: [] };
    group.values.push(value);
    groups.set(key, group);
  }

  const selected: T[] = [];
  while (groups.size > 0 && selected.length < count) {
    const round = [...groups.keys()];
    while (round.length > 0 && selected.length < count) {
      const groupIndex = weightedGroupIndex(round, groups, memory, random);
      const key = round.splice(groupIndex, 1)[0]!;
      const group = groups.get(key)!;
      const valueIndex = Math.min(
        group.values.length - 1,
        Math.floor(random.next() * group.values.length),
      );
      selected.push(group.values.splice(valueIndex, 1)[0]!);
      if (group.values.length === 0) groups.delete(key);
    }
  }
  return selected;
}

function weightedGroupIndex<T>(
  keys: readonly string[],
  groups: ReadonlyMap<string, { scope: DifficultyScope; values: readonly T[] }>,
  memory: DifficultyMemory,
  random: RandomSource,
): number {
  const total = keys.reduce((sum, key) => {
    const scope = groups.get(key)!.scope;
    return sum + memory.selectionWeight(scope.courseId, scope.objectId);
  }, 0);
  let cursor = random.next() * total;
  for (let index = 0; index < keys.length; index += 1) {
    const scope = groups.get(keys[index]!)!.scope;
    cursor -= memory.selectionWeight(scope.courseId, scope.objectId);
    if (cursor < 0) return index;
  }
  return keys.length - 1;
}

function fullyCorrectOf(attempt: DifficultyAttempt): boolean {
  return attempt.fullyCorrect ?? attempt.score >= 1;
}

function scopeKey(scope: DifficultyScope): string {
  return JSON.stringify([scope.courseId, scope.objectId]);
}
