# Sokole Oko 基线

> 候选基线 v0.1（未冻结，Znawca 切片验证后冻结 v1.0）。共性约束见 `README.md`。

## 定位

视觉点选引擎：看图 → 点击指定区域 → 按 mask 判定对错。知识题（单点）/ 观察题（多点）两类；学习/测试两模式。

## 评分

各区域分数（found/total，dimensions[]）。

## 复用

~20%。图+mask+txt 数据模型与点选/容差算法可沿用。

## 适用第二层列

B/C/D/G/H（不适用 E/F）。

## 需求原文过时项（勿采信）

- 桌面版 + 多 profile → 归平台账号。
- problem-area 自动加权 → 归 Learning State。
- §5 测试"百分比" → 平台归一 0-1 + dimensions。
- "从断点继续" → 平台中断语义（activity 从头、mastery 丢弃）。
- 6 语言界面 → Shell 统一（语言清单待平台定）。

## 待澄清

界面语言清单（5 语言 vs 6 语言简繁，待平台统一）。
