import type { RandomSource } from "../quiz/types";

/**
 * D-12：课程级正误提示音的文件名模式——`correct NN.mp3` / `incorrect NN.mp3`，
 * NN 为两位数字（00–99，可不连续）。供扫描器（feedback-sounds.ts）与通用媒体
 * 扫描（media.ts 排除合法提示音、避免误报为对象媒体）共用。
 */
export const FEEDBACK_SOUND_PATTERN = /^(correct|incorrect) (\d{2})\.mp3$/;

/**
 * D-12：从排序后的候选中选择下一个提示音，可注入随机源使测试可复现。
 * - 集合为空返回 -1（调用方不播放）；
 * - 只有一个候选时允许重复；
 * - 两个以上候选时尽量不与上一次（previousIndex）相同。
 *
 * 本模块为纯函数，不依赖 Node 内置模块，可安全被 renderer 侧（feedback-playback）
 * 引用；而依赖 node:fs/promises 的扫描逻辑（scanFeedbackSounds）单独放在
 * feedback-sounds.ts，仅供主进程使用，避免把 Node 模块带进浏览器 bundle。
 */
export function selectFeedbackSound(candidates: readonly string[], random: RandomSource, previousIndex: number): number {
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return 0;
  const index = Math.floor(random.next() * candidates.length);
  return index === previousIndex ? (index + 1) % candidates.length : index;
}
