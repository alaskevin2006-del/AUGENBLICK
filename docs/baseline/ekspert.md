# Ekspert 基线

> 候选基线 v0.1（未冻结，Znawca 切片验证后冻结 v1.0）。共性约束见 `README.md`。

## 定位

多轴分类引擎：看图/示意图，在多个独立轴（物种/体征/时代…）上同时判定。四模块（动物足迹/牙齿/陶瓷/化石）；单轴 quiz / 多轴 quiz + atlas/对比/决策树。

## 评分

各轴分数（dimensions[]），平台归一 0-1 汇总。

## 复用

~20%。JSON 数据（data.json/trees.json）沿用；学习机制重写以映射平台 L/T。

## 适用第二层列

B/C/D/E/F/G/H（E Scope 适用，Ekspert）。

## 需求原文过时项（勿采信）

- §2.1 PWA/offline、§4.6 Field Mode → V1 不实现。
- §5 SM-2 + confusion matrix + mastery coefficient → 映射平台 L/T + dimensions。
- §2.1 localStorage/SQLite 持久化 → 后端。

## 待澄清

Atlas/Comparison/Decision Tree 等模式与平台 L/T + REVIEW 的映射（超平台模型部分待裁）。
