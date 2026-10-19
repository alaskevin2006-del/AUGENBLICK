import type { AnswerEvaluation, Question } from "../quiz/types";
import { progressUnitKey, progressUnitTotal, type ProgressUnitCounts } from "../progress/knowledge-progress";

export interface LearningQuestionProgress {
  readonly question: Question;
  readonly requiredStreak: 1 | 2;
  readonly correctStreak: number;
  readonly attempts: number;
}

export interface LearningAnswerRecord {
  readonly questionId: string;
  readonly question: Question;
  readonly evaluation: AnswerEvaluation;
  readonly answeredAt: string;
  readonly submittedAnswers: readonly string[];
}

export interface LearningSnapshot {
  readonly queue: readonly LearningQuestionProgress[];
  readonly completedQuestionIds: readonly string[];
  readonly records?: readonly LearningAnswerRecord[];
  /** D-24：进度单位总数，Learning 开始时固定（重试不增）。旧快照缺省时按题目重算。 */
  readonly unitTotal?: number;
}

export class LearningSession {
  private queue: LearningQuestionProgress[];
  private completed = new Set<string>();
  private records: LearningAnswerRecord[] = [];
  /** D-24：进度单位总数——构造时固定，重答/重试不改变。 */
  private readonly unitTotal: number;
  /** D-24：已达到移除条件（完成）的进度单位键。 */
  private readonly completedUnits = new Set<string>();

  constructor(questionsOrSnapshot: readonly Question[] | LearningSnapshot) {
    if (!isSnapshot(questionsOrSnapshot)) {
      this.queue = questionsOrSnapshot.map((question) => ({ question, requiredStreak: 1, correctStreak: 0, attempts: 0 }));
      this.unitTotal = progressUnitTotal(questionsOrSnapshot);
    } else {
      this.queue = questionsOrSnapshot.queue.map((progress) => ({ ...progress }));
      this.completed = new Set(questionsOrSnapshot.completedQuestionIds);
      this.records = [...(questionsOrSnapshot.records ?? [])];
      // 旧快照（D-24 之前保存）没有 unitTotal：用队列与全部历史记录中的题目重算，
      // 覆盖「初始题目集合」的近似值；新快照直接沿用开始时固定的总数。
      this.unitTotal = questionsOrSnapshot.unitTotal
        ?? progressUnitTotal([...this.queue.map((progress) => progress.question), ...this.records.map((record) => record.question)]);
      const completedIds = this.completed;
      for (const record of this.records) {
        if (completedIds.has(record.questionId)) this.completedUnits.add(progressUnitKey(record.question));
      }
    }
  }

  current(): Question | undefined {
    return this.queue[0]?.question;
  }

  answer(
    questionId: string,
    evaluation: AnswerEvaluation,
    answeredAt = new Date().toISOString(),
    submittedAnswers: readonly string[] = [],
  ): LearningQuestionProgress {
    const progress = this.queue.shift();
    if (!progress || progress.question.id !== questionId) throw new Error("Answer does not match the current learning question.");
    const attempts = progress.attempts + 1;
    this.records.push({
      questionId,
      question: progress.question,
      evaluation,
      answeredAt,
      submittedAnswers: [...submittedAnswers],
    });
    if (!evaluation.fullyCorrect) {
      const question = reshuffleChoiceOptions(progress.question);
      const updated = { ...progress, question, requiredStreak: 2 as const, correctStreak: 0, attempts };
      this.queue.push(updated);
      reshuffleQueueAfterMiss(this.queue, updated);
      return updated;
    }
    const streak = progress.correctStreak + 1;
    if (streak >= progress.requiredStreak) {
      this.completed.add(questionId);
      // D-24：题目达到移除条件 → 其「名称＋学习单元格」单位计为已掌握（Set 去重，
      // 正反向/题型/变体的另一道题完成时不会重复累计）。
      this.completedUnits.add(progressUnitKey(progress.question));
    }
    else this.queue.push({ ...progress, correctStreak: streak, attempts });
    return { ...progress, correctStreak: streak, attempts };
  }

  isComplete(): boolean {
    return this.queue.length === 0;
  }

  /**
   * D-24：Learning 进度统计。总数在开始时固定；已完成＝达到移除条件的单位数；
   * 剩余＝总数－已完成。重试（答错重入队）只影响 completed，不改变 total。
   */
  progressUnits(): ProgressUnitCounts {
    return {
      total: this.unitTotal,
      completed: this.completedUnits.size,
      remaining: Math.max(0, this.unitTotal - this.completedUnits.size),
    };
  }

  snapshot(): LearningSnapshot {
    return {
      queue: this.queue.map((progress) => ({ ...progress })),
      completedQuestionIds: [...this.completed],
      records: [...this.records],
      unitTotal: this.unitTotal,
    };
  }
}

function isSnapshot(value: readonly Question[] | LearningSnapshot): value is LearningSnapshot {
  return "queue" in value;
}

/**
 * 答错重入队时，对选择题的选项重新随机打乱，避免重复出现时顺序固定。
 * 只浅拷贝 question（options 为新数组），不修改历史记录里保存的原对象。
 */
function reshuffleChoiceOptions(question: Question): Question {
  if (question.kind !== "choice" || !question.options?.length) return question;
  const options = [...question.options];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [options[index], options[swap]] = [options[swap]!, options[index]!];
  }
  return { ...question, options };
}

/**
 * 答错回池后重新打乱剩余题目顺序，避免首轮随机后按固定队列循环。
 * 队列中还有其他题时，把刚答错的题从首位移开，避免立刻原题重来。
 */
function reshuffleQueueAfterMiss(queue: LearningQuestionProgress[], missed: LearningQuestionProgress): void {
  if (queue.length <= 1) return;
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[swap]] = [queue[swap]!, queue[index]!];
  }
  if (queue[0] !== missed) return;
  const swap = 1 + Math.floor(Math.random() * (queue.length - 1));
  [queue[0], queue[swap]] = [queue[swap]!, queue[0]!];
}
