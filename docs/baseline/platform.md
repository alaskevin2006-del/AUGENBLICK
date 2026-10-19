# 平台（Platform）基线

> 候选基线 v0.1（未冻结，Znawca 切片验证后冻结 v1.0）。共性约束见 `README.md`，本文件只列平台特有。

## 定位

AUGENBLICK 学习操作系统：学习者看课程/目标/进度/练习/反馈；开发者看结构/校验/预览/发布。含 Shell、编排器、Web 后端（API/DB/认证/支付桩）、内容流水线、Course Studio/后台。

## 职责边界

- **拥有**：账号、课程目录、编排调度、Learning State、统一判分、内容流水线、双品牌站点。
- **不拥有**：各引擎领域逻辑与第三层数据格式（对平台不透明，仅暴露 package/checkpoint/itemCount/声音版本）。

## 第二层脚本列（平台定义）

A Step · B 引擎（或保留关键字 REVIEW，见 AUGENBLICK §6）· C 数据文件 · D Package/Checkpoint · E Scope(Znawca/Ekspert) · F 题型(Znawca/Anvil/Ekspert) · G 题数 · H L/T。

## 后置保留（不进 V1，接口先留位）

- 观察者角色（只读账户 + 邀请码，AUGENBLICK §9）——后置接入。
- 埋点 / 北极星分析（Analysis API 后置接入，ADR-0001/边界与验收）。

## 待澄清

OPEN-QUESTIONS #7(`_M/_F`)、#8(监护人授权)、#9(账户互通)、#10(数据驻留)、#11(最低分门槛)、#12(Sokole Oko 缺译静默跳过 vs 静默跳过=0)、#13(Ekspert Scope→轴名映射 + dimensions[] 子结构)、#14(内容目录结构 + Znawca 出题语法)。
