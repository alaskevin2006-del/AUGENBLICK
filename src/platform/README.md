# Platform 平台

> AUGENBLICK 学习操作系统（Shell + 编排器 + Web 后端 + 内容流水线 + Course Studio/后台）。

- 引擎：Platform（`src/platform/`）
- 依赖合约：`../../docs/合约.md`（当前 v0.3，草案）
- 开工前必读：`../../docs/工作约定.md`、`../../docs/GLOSSARY.md`、`../../docs/ARCHITECTURE.md`、`../../docs/边界与验收.md`

## 一句话职责

学习操作系统：学习者看课程/目标/进度/反馈；开发者看结构/校验/预览/发布。拥有 Shell、编排器、Learning State、内容流水线、统一判分。

## 目录

- `src/` —— 平台代码
- `tests/` —— 测试
- `docs/` —— 本平台边界与验收
- `进度.md` —— 本平台详细进度日志（append-only）

## 治理约定

- 全局契约唯一放根 `docs/`，本平台**只引用、不复制**。
- 本平台内部决策写 `docs/adr/`；跨引擎 / 需客户拍板的决策回报规划总控，由总控写根 `docs/adr/` 或 `docs/OPEN-QUESTIONS.md`。
- 本平台状态变化只回报总控一句「Platform：状态 A→B，阻塞 C」，由总控更新根 `docs/进度.md` 仪表盘那一行（单向同步）。
