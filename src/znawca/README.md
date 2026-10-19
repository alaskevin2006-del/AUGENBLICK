# Znawca 引擎

> 抽认卡引擎：显示图（或文）→ 提问 → 作答 → 评分。学习/测试两模式。AUGENBLICK 平台 5 引擎之一，切片验证引擎。

- 引擎：Znawca（`src/znawca/`）
- 依赖合约：`../../docs/合约.md`（当前 v0.3，草案，待 Znawca 切片跑通后冻结）
- 复用：复用原 Znawca core（评分/抽题/会话状态机/难度跟踪/进度/多语言）+ 答题 UI；剥离 Electron 壳；loader 抽数据源接口；事件 pull→push
- 开工前必读：`../../docs/工作约定.md`、`../../docs/GLOSSARY.md`、`../../docs/ARCHITECTURE.md`、`../../docs/边界与验收.md`

## 一句话职责

呈现抽认卡活动（载题 / 选题 / 作答 / 评分），理解第三层数据（Excel + 图片子文件夹），提交领域评分证据（0/1）。不碰进度显示、对错裁决、掌握度、调度、账号支付。

## 目录

- `src/` —— 引擎代码（`core` 领域逻辑 / `ui` 答题界面 / `adapter` 合约适配器 / `datasource` 数据源）
- `tests/` —— 测试（含 `contract` 合约一致性测试）
- `docs/` —— 本引擎治理：`边界.md`、`验收.md`
- `进度.md` —— 本引擎详细进度日志（append-only）

## 治理约定

- 全局契约（合约 / 架构 / 术语表 / 工作约定 / 全局进度）唯一放根 `docs/`，本引擎**只引用、不复制**。
- 本引擎内部决策写 `docs/adr/`；跨引擎 / 需客户拍板的决策回报规划总控，由总控写根 `docs/adr/` 或 `docs/OPEN-QUESTIONS.md`。
- 本引擎状态变化只回报总控一句「Znawca：状态 A→B，阻塞 C」，由总控更新根 `docs/进度.md` 仪表盘那一行（单向同步）。
