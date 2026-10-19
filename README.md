# AUGENBLICK 项目索引

在线订阅制语言培训平台，定位「学习操作系统」，整合 5 个教学引擎 + Direct 保留位。本文件是**人和 agent 的唯一定位入口**，进项目先读这里。

## 目录结构

| 目录 | 内容 | 谁读 |
|---|---|---|
| `requirements/` | 需求方案（**英文 `.md`**） | **agent 唯一正文入口** |
| `requirements/sources/` | 归档：docx 原版 + 中文翻译 `_中文.md` | agent 默认不进 |
| `requirements/feedback/` | 用户反馈截图文档（docx，图文配对） | 按需直读 |
| `docs/` | 工程治理：基线、合约、进度、ADR、边界验收、架构、术语表、待决清单、工作约定 | 项目过程 |
| `src/` | 开发产物：`platform/` + 5 引擎 + Direct 保留位 + `_template/`（模板） | 各引擎开发 |

## 阅读顺序与冲突处理（总纲）

- **阅读顺序**：本 README → `docs/baseline/README.md` → `docs/合约.md` → `docs/边界与验收.md` → `docs/ARCHITECTURE.md` → `docs/GLOSSARY.md` → `docs/工作约定.md` → 相关 `docs/adr/`。各子项目另读 `src/<引擎>/AGENT.md`（Agent 入口，单数命名）。
- **权威来源**：开发基线 = `docs/baseline/` + `docs/adr/` + `docs/合约.md`；`requirements/` 仅溯源。
- **冲突处理**：以 `docs/baseline/README.md` 的文档优先级表为准；跨引擎决策报规划总控写 `docs/adr/` 或 `docs/OPEN-QUESTIONS.md`，不在子项目内擅自定。

## agent 阅读铁律（务必遵守）

1. 分析/引用需求内容时，**只读 `requirements/*.md`（英文版）**，不重复读同名 docx；但需注意：`requirements/*.md` 是**客户原始需求/历史存档，不是开发基线**，含"平台化前"内容（桌面版、独立账号支付、PWA 等），与治理文档冲突时**以治理文档为准**。开发基线 = `docs/baseline/` + `docs/adr/` + `docs/合约.md`。
2. `requirements/sources/` 下的 docx 原版与 `_中文.md` 是归档/翻译，**默认不读**；仅当需要原版格式、图片，或用户明确要中文转述时才按需读取。
3. `requirements/feedback/` 的反馈 docx 图文配对，**按需直读、不拆图、不转纯文本**。

## 引擎清单

- 教学引擎（有文档）：Anvil、Znawca、Ekspert、Sokole Oko、Companion
- 平台：AUGENBLICK（主平台文档）
- 保留位（无文档）：Direct（需向客户澄清）

## 产品基线

- 平台 + 5 引擎 + Direct 保留位的权威基线在 `docs/baseline/`，各子项目开工前必读对应基线文件（共性约束见 `docs/baseline/README.md`）。

## 在线试点（2026-10-19）

- [打开 AUGENBLICK](https://124.221.230.69:18443/)：当前为 Znawca 学习/测试试点，已具备独立开发者页、草稿预览/发布、选择课程/我的课程与五种界面语言；完整平台及其他引擎仍在后续范围。
- [最新交付与验收](docs/releases/2026-10-19-role-pages.md) · [首次上线记录](docs/releases/2026-10-19-pilot.md) · [部署与回滚](src/platform/deploy/README.md) · [全局进度](docs/进度.md)。
- 开发者和普通用户账号凭证仅在本机 `AUGENBLICK-access.local` 保存，不进入仓库。
