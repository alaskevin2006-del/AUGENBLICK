# Znawca 基线

> 候选基线 v0.1（未冻结，Znawca 切片验证后冻结 v1.0）。共性约束见 `README.md`。

## 定位

抽认卡引擎：显示图（或文）→ 提问 → 作答 → 评分。学习/测试两模式；题型：文本输入 / 多选(3-4 按钮) / 选图 / 纯文本双向。

## 评分

0/1。

## 复用

复用原 Znawca 的 core（评分/抽题/会话状态机/难度跟踪/进度/多语言）+ 答题 UI；剥离 Electron 壳；loader 抽数据源接口；事件 pull→push。

## 适用第二层列

B/C/D/E/F/G/H。

## 需求原文过时项（勿采信）

- §11 桌面版为主形态 → 平台内 Web 组件。
- §11 "web 是未来可能" → 已是既定 Web 形态。
- §8 difficulty memory、§4.2 score history → 归 Learning State。
- §4.2 testing timer → V1 不实现（同 Anvil）。

## 待澄清

无引擎特有（代表课见 OPEN-QUESTIONS #3）。
