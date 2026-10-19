import { selectFeedbackSound } from "./course/feedback-sound-select";
import type { RandomSource } from "./quiz/types";
import type { Question } from "./quiz/types";

export interface PlayableAudio {
  volume: number;
  play(): void;
  pause(): void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}

export type AudioFactory = (source: string, volume: number) => PlayableAudio;

// 生产环境的音频工厂：游离 <audio> 元素（不挂入 DOM），因此其 play 事件不会
// 冒泡到 document，不会误触发“手动播放”的取消逻辑。包装对象把 DOM 事件桥接
// 为 PlayableAudio 的回调；自动播放被拒（promise reject）会转为 error 让协调器跳过。
export const domAudioFactory: AudioFactory = (source, volume) => {
  const audio = document.createElement("audio");
  audio.src = source;
  audio.volume = volume;
  let endedHandler: (() => void) | null = null;
  let errorHandler: (() => void) | null = null;
  audio.addEventListener("ended", () => endedHandler?.());
  audio.addEventListener("error", () => errorHandler?.());
  return {
    get volume() { return audio.volume; },
    set volume(value: number) { audio.volume = value; },
    play() {
      const result = audio.play();
      if (result && typeof (result as { catch?: unknown }).catch === "function") {
        (result as Promise<void>).catch(() => errorHandler?.());
      }
    },
    pause() {
      try { audio.pause(); } catch { /* 播放器不可用：忽略，协调器用令牌结束链 */ }
    },
    get onended() { return endedHandler; },
    set onended(handler: (() => void) | null) { endedHandler = handler; },
    get onerror() { return errorHandler; },
    set onerror(handler: (() => void) | null) { errorHandler = handler; },
  };
};

/**
 * D-13：单一播放协调器。一条“链”内的多个音频串行播放：上一段 ended 后才
 * 播放下一段；任一段 error、播放被拒或工厂创建失败都跳过该段继续下一段。
 * 任何新播放请求会递增 generation，使旧链的事件回调全部失效（等价于取消旧链）。
 */
export class PlaybackCoordinator {
  private generation = 0;
  private current: PlayableAudio | null = null;
  private volumeValue = 1;

  constructor(private readonly createAudio: AudioFactory) {}

  setVolume(volume: number): void {
    this.volumeValue = volume;
    if (this.current) this.current.volume = volume;
  }

  /** 停止当前链；之后的新播放请求使用新的 generation。 */
  cancel(): void {
    this.generation += 1;
    const audio = this.current;
    this.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
  }

  /** 串行播放 sources；sources 为空或全为空字符串时不做任何事。 */
  play(sources: readonly string[]): void {
    this.generation += 1;
    const generation = this.generation;
    if (this.current) {
      this.current.onended = null;
      this.current.onerror = null;
      this.current.pause();
      this.current = null;
    }
    let index = 0;
    const step = (): void => {
      if (generation !== this.generation) return;
      while (index < sources.length) {
        const source = sources[index];
        index += 1;
        if (!source) continue;
        const release = (): void => {
          if (generation === this.generation) {
            this.current = null;
            step();
          }
        };
        let audio: PlayableAudio;
        try {
          audio = this.createAudio(source, this.volumeValue);
        } catch {
          // 创建失败（如损坏/不可达资源）：跳过该段继续下一段，不抛出。
          release();
          return;
        }
        this.current = audio;
        audio.onended = release;
        audio.onerror = release;
        try {
          audio.play();
        } catch {
          release();
        }
        return;
      }
      this.current = null;
    };
    step();
  }
}

/**
 * D-13：确定某题的“正确答案音频”。本轮沿用 V1 语义，只接受两类可可靠确定的情况：
 * - `audio-to-name`：题干本身就是正确答案的声音（question.media 为音频）；
 * - `name-to-audio`：正确选项（value 在 acceptedAnswers 中）是音频。
 * 其余方向当前无法可靠确定正确答案媒体，返回 undefined（调用方跳过并记录，不得猜测）；
 * V2 文字答案的朗读回退由 `answerSpeech` 参数提供（D-22 speech 坐标）。
 */
export function answerAudioPath(question: Question): string | undefined {
  if (question.direction === "audio-to-name" && question.media?.kind === "audio") {
    return question.media.path;
  }
  if (question.direction === "name-to-audio") {
    const accepted = new Set(question.acceptedAnswers);
    const correctOption = question.options?.find(
      (option) => accepted.has(option.value) && option.media?.kind === "audio",
    );
    return correctOption?.media?.path;
  }
  return undefined;
}

export interface FeedbackPlaybackSelection {
  /** 待播放链：正误提示音（若有）在前，正确答案音频（若可确定）在后。 */
  readonly chain: readonly string[];
  /** 本次使用的 correct 集合索引（-1 表示未用），用于下一次避重。 */
  readonly correctIndex: number;
  /** 本次使用的 incorrect 集合索引（-1 表示未用），用于下一次避重。 */
  readonly incorrectIndex: number;
}

export interface FeedbackPlaybackParams {
  readonly fullyCorrect: boolean;
  readonly feedbackSounds: { readonly correct: readonly string[]; readonly incorrect: readonly string[] } | undefined;
  readonly question: Question;
  readonly random: RandomSource;
  readonly previousCorrectIndex: number;
  readonly previousIncorrectIndex: number;
  /** D-22：文字题正确答案的单元格朗读链（V2 speech 坐标）。仅当无可靠答案媒体时接在链尾。 */
  readonly answerSpeech?: readonly string[];
}

/**
 * D-12 + D-13：完全正确使用 correct 集合，部分正确/错误/超时（fullyCorrect=false）
 * 使用 incorrect 集合；选择结果随后接正确答案音频（若可确定），无答案媒体时回退
 * 接 answerSpeech（D-22 文字答案朗读）。纯函数，便于测试复现。
 */
export function buildFeedbackPlaybackChain(params: FeedbackPlaybackParams): FeedbackPlaybackSelection {
  const pool = params.fullyCorrect ? params.feedbackSounds?.correct ?? [] : params.feedbackSounds?.incorrect ?? [];
  const previousIndex = params.fullyCorrect ? params.previousCorrectIndex : params.previousIncorrectIndex;
  const soundIndex = selectFeedbackSound(pool, params.random, previousIndex);
  const chain: string[] = [];
  if (soundIndex >= 0 && soundIndex < pool.length) chain.push(pool[soundIndex]);
  const answerPath = answerAudioPath(params.question);
  if (answerPath) {
    chain.push(answerPath);
  } else if (params.answerSpeech && params.answerSpeech.length > 0) {
    chain.push(...params.answerSpeech);
  }
  return {
    chain,
    correctIndex: params.fullyCorrect ? soundIndex : params.previousCorrectIndex,
    incorrectIndex: params.fullyCorrect ? params.previousIncorrectIndex : soundIndex,
  };
}
