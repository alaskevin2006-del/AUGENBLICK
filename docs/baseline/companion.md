# Companion 基线

> 候选基线 v0.1（未冻结，Znawca 切片验证后冻结 v1.0）。共性约束见 `README.md`。

## 定位

脚本驱动语音课引擎：逐行读 Excel 脚本 → 播音频/显文本 → 采集语音并评估发音。checkpoint 支持从指定段开始。

## 评分

音素 / 节奏 / 语调（dimensions[]）。

## 复用

~5%。脚本逐行执行逻辑可沿用；语音评估（VAD/DTW/强制对齐/频谱比对）全新写。

## 适用第二层列

B/C/D/H（D=checkpoint，渐进式引擎；不适用 E/F/G）。

## 需求原文过时项（勿采信）

- §1 "至言" → AUGENBLICK。
- §1/§7 unit-tier/course-tier 两层脚本 → 平台三层内容模型。
- `_M/_F` 性别变体（Companion 文档未定义）→ 平台 §4.3，待澄清。

## 待澄清

`_M/_F` 变体（OPEN-QUESTIONS #7）；语音评估准确率指标（OPEN-QUESTIONS #2）。
