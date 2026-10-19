# Companion 引擎

2026-10-19：已实现 ADR-0015 范围内的脚本、录音和本地声学对比试运行阶段。正式音素评分仍待语言模型与人工校准，测试模式暂不可用。使用方式和限制见 [STAGED-PRACTICE.md](docs/STAGED-PRACTICE.md)，可上传示例在 [templates/companion-example.zip](templates/companion-example.zip)。

> 脚本驱动的语言训练引擎：读第三层 Excel（A–Q 列），逐行播放音频、显示文本、采集学习者语音做发音评估；末行执行完显示「Click to continue」按钮，等学习者按下后把控制权交还编排器。

- 引擎：Companion
- 依赖合约：`../../docs/合约.md`（当前 v0.3 草案，待 Znawca 切片跑通后冻结）
- 开工前必读：`../../docs/工作约定.md`、`../../docs/GLOSSARY.md`、`../../docs/ARCHITECTURE.md`、`../../requirements/COMPANION.md`

## 目录

- `src/` —— 引擎代码（`core` 领域逻辑 / `ui` 答题界面 / `adapter` 合约适配器 / `datasource` 数据源）
- `tests/` —— 测试（含 `contract` 合约一致性测试）
- `docs/` —— 本引擎治理：`边界.md`、`验收.md`、`待确认.md`、`adr/`（引擎内部 ADR）
- `进度.md` —— 本引擎详细进度日志（append-only）

## 治理约定

- 全局契约（合约 / 架构 / 术语表 / 工作约定 / 全局进度）唯一放根 `docs/`，本引擎**只引用、不复制**。
- 本引擎内部决策写 `docs/adr/`；跨引擎 / 需客户拍板的决策回报规划总控，由总控写根 `docs/adr/` 或 `docs/OPEN-QUESTIONS.md`。
- 本引擎状态变化只回报总控一句「Companion：状态 A→B，阻塞 C」，由总控更新根 `docs/进度.md` 仪表盘那一行（单向同步，不自动、不双向）。
