# Anvil 引擎代码分层

> 引擎代码按 `../../docs/工作约定.md §六` 分四层，依赖方向单向（下层不反向依赖上层），契约只在 `adapter` 层实现。

## 分层与职责

| 层 | 目录 | 职责 | 依赖 |
|---|---|---|---|
| 领域逻辑 | `core/` | 题型分型、选项乱序、会话状态机、评分证据组装。纯 TS，不依赖 React / 浏览器 / 平台 | 无（纯函数优先） |
| 数据源 | `datasource/` | 从编译产物（不可变 Course Version）读题目与资产清单，媒体经签名 URL 取回 | `core` |
| 答题界面 | `ui/` | 9 题型渲染组件，面向 Activity Host 挂载（非 iframe），键盘可全操作、RTL 由 Host 管 | `core` |
| 合约适配器 | `adapter/` | 实现三份合约：内容编译（`capabilities/parse/validate/compile/estimateItemCount/migrate`）+ 运行时四事件（pull→push）+ UI 宿主挂载 | `core` / `ui` / `datasource` |

## 依赖铁律

- 依赖方向：`adapter → ui / datasource → core`，`core` 不依赖任何人。
- **逻辑全走 API，不进浏览器**：评分 / 进度 / 错题 / 调度规则不写在本引擎（归平台后端），引擎只产领域评分证据。
- 运行时只读不可变 Course Version，不读源 Excel / 文件系统（ADR-0004 / 0008）。
- 引擎内部随机化（选项乱序等）必须使用编排器下发的随机种子，保证「题集 / 随机种子可追溯」验收项。
