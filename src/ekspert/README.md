# Ekspert 引擎

> 说明这是什么引擎、怎么启动、依赖合约版本。

- 引擎：Ekspert
- 依赖合约：`../../docs/合约.md`（当前 v0.3，草案，待 Znawca 切片跑通后冻结）
- 开工前必读：`../../docs/工作约定.md`、`../../docs/GLOSSARY.md`、`../../docs/ARCHITECTURE.md`

## 目录

- `src/` —— 引擎代码（`core` 领域逻辑 / `ui` 答题界面 / `adapter` 合约适配器 / `datasource` 数据源）
- `tests/` —— 测试（含 `contract` 合约一致性测试）
- `docs/` —— 本引擎边界与验收 + 引擎内部 ADR
- `进度.md` —— 本引擎详细进度日志（append-only）

## 治理文档导航（分层）

- **引擎特有（本目录自维护）**：`docs/边界.md`、`docs/验收.md`、`进度.md`、`docs/adr/`
- **全局契约（引用上游，只读不复制）**：
  - `../../docs/合约.md` —— 引擎统一合约（唯一真相源）
  - `../../docs/ARCHITECTURE.md` —— 架构地图
  - `../../docs/GLOSSARY.md` —— 术语表
  - `../../docs/工作约定.md` —— 协作约定
  - `../../docs/OPEN-QUESTIONS.md` —— 待决清单
