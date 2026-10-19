# 产品基线（BASELINE）

> AUGENBLICK 唯一产品基线。规划总控维护，变更走 ADR（升版本 + 记 ADR + 更新本页变更记录）。
> 当前版本：**v0.1（候选，未冻结）**——合约 v0.3 仍为草案，待 Znawca 切片验证后冻结 v1.0

## 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | 2026-08-26 | 候选基线：平台 + 5 引擎 + Direct 保留位基线；明确 requirements 地位（未冻结） |

## 一、requirements 的地位（重要）

`requirements/*.md` 是**客户原始需求 / 历史存档，不是开发基线**。它含"平台化前"内容（各引擎作独立产品的桌面版、独立账号支付、PWA 等），与治理文档冲突时**一律以治理文档为准**。开发基线 = 本目录 + `docs/adr/` + `docs/合约.md`；需求文档仅作溯源与补充说明。

补充说明 docx（`AUGENBLICK补充说明.docx` / `Anvil补充说明.docx`）同属原始需求归档。**仍有效、与现有决策不冲突的结论须沉淀进 md 或本基线**，否则不得作为开发依据：Anvil补充说明 ①（内容单元可为文本/图片/音频/视频）②（A 列难度等级 + 首行表头 + 从第 2 行读）已沉淀进 `src/anvil/docs/边界.md`；AUGENBLICK补充说明 ④（六文件夹目录结构 + Znawca 列指向出题语法）待平台定，见 OPEN-QUESTIONS。

## 二、共性基线（所有子引擎共守，逐份不重复）

- **定位**：5 引擎 + Direct 保留位是 AUGENBLICK 平台的**子引擎**，非独立产品。
- **不负责**（全归平台腿）：账户/认证/支付→Shell · 进度/错题/间隔复习→Learning State · 编排/随机种子→编排器 · 导航/进度条/语言/RTL→Shell · 内容导入/编译/版本→内容流水线 · 判分裁决→统一答案求值管线。
- **文档优先级**（冲突以高者为准，低者让位不覆盖）：① docs 治理 + baseline + ADR ＞ ② requirements/AUGENBLICK.md + AUGENBLICK补充说明 ＞ ③ requirements/<引擎>补充说明 ＞ ④ requirements/<引擎>.md。
- **三条红线**：判分/学习状态/自适应/权威进度在后端（前端只展示+调用）· 合约唯一不复制 · V1 纯 Web 无 PWA。

## 三、已定决策（出处即锚点，内容见源文件；合约 v0.3 与基线整体仍为草案/未冻结）

| 维度 | 决策 | 出处 |
|---|---|---|
| 形态 | V1 纯 Web 无离线；离线后置走原生 App | ADR-0002 / 边界与验收 |
| 品牌 | Polyglot/Savant 单代码库双站点，品牌运行时注入 | ADR-0006 |
| 商务 | MVP 不接真实支付（页面 + 接口占位 + 链路定死） | ADR-0001 |
| 架构 | 模块化单体 + 引擎注册表 + Activity Host + 五方状态归属 | ADR-0002 / 0003 |
| 内容 | 三层模型；Excel=交换格式→不可变 Course Version；混合存储 + 流水线 | ADR-0004 / 0008 |
| 判分 | 统一答案求值管线；引擎交 dimensions，平台裁决 | ADR-0005 |
| 技术栈 | React+TS+Vite / Django+DRF / Celery+Redis / PG17 / S3 / Compose | ADR-0007 |
| 合约 | 三份合约 v0.3（草案）+ 四事件 + score 0-1 + dimensions | docs/合约.md |
| 学习语义 | 完成/通过/解锁三态；三轮逃逸仅学习；提交才算尝试；门槛可配置 | ADR-0009 |

## 四、子引擎基线索引

| 引擎 | 基线文件 | 核心功能 | 评分 |
|---|---|---|---|
| 平台 | platform.md | 学习操作系统（Shell + 编排 + 后端 + 流水线 + 后台） | 平台裁决 |
| Znawca | znawca.md | 抽认卡（图/文 → 提问 → 评分） | 0/1 |
| Anvil | anvil.md | 9 题型交互 | 0/1 |
| Ekspert | ekspert.md | 多轴分类 | 各轴 |
| Sokole Oko | sokole-oko.md | 视觉点选 | 各区域 |
| Companion | companion.md | 脚本语音课 | 音素/节奏/语调 |
| Direct | direct.md | 保留位 | 待定 |

## 五、未决项

见 `../OPEN-QUESTIONS.md`：#1 Direct 需求、#2 语音准确率、#3 各引擎代表课、#5 服务器/域名、#6 安全合规、#7 `_M/_F`、#8 监护人授权、#9 账户互通、#10 数据驻留、#11 最低分门槛、#12 Sokole Oko 缺译静默跳过、#13 Ekspert 接口子结构。
