# Sokole Oko 引擎

> 视觉识别教学引擎：看图片、点击图片特定区域作答，用黑/白掩膜 PNG 判定点击是否正确。AUGENBLICK 平台 5 引擎之一。

- 引擎：Sokole Oko（`src/sokole-oko/`）
- 依赖合约：`../../docs/合约.md`（当前 v0.3，草案，待 Znawca 切片跑通后冻结）
- 复用度：约 20%（从零新写，非复用现有程序）
- 开工前必读：`../../docs/工作约定.md`、`../../docs/GLOSSARY.md`、`../../docs/ARCHITECTURE.md`、`../../docs/边界与验收.md`

## 一句话职责

呈现视觉识别活动（载图 / 渲染掩膜 / 捕获点击 / 命中判定 + 动态容差），理解第三层数据（文件夹 → 编译为规范化内容），提交领域评分证据（`dimensions[]` = 各区域命中，`score` = 命中区域数 ÷ 总区域数）。不碰进度显示、对错裁决、掌握度、调度、账号支付。

## 目录

- `src/` —— 引擎代码（`core` 领域逻辑 / `ui` 答题界面 / `adapter` 合约适配器 / `datasource` 数据源）
- `tests/` —— 测试（含 `contract` 合约一致性测试）
- `docs/` —— 本引擎边界与验收 + 引擎内部 ADR（`docs/adr/`）
- `进度.md` —— 本引擎详细进度日志（append-only）

## 关键待确认（详见 `docs/边界.md`）

1. 缺译处理与全局红线「必修活动静默跳过 = 0」的冲突
2. Problem Area Memory（错题加权）归属：平台架构下归 Learning State，引擎不实现
3. 第三层数据编译方式：文件夹式内容如何 parse/validate/compile 成不可变 Course Version
