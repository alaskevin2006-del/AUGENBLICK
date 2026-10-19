# ADR-0003: 统一 Activity Host（否 sandbox iframe 默认）

- 状态：已接受
- 日期：2026-08-25
- 决策人：恺欣

## 背景

原需求默认「sandbox iframe 嵌入包装」集成策略。但 iframe 带来沙箱边界、风格割裂、事件通信开销，且无法统一焦点/键盘/RTL/无障碍。

## 决策

新引擎统一接入**共享 Activity Host**（统一主题、尺寸、焦点、键盘、RTL、媒体权限、暂停、退出确认、错误界面）。sandbox iframe 仅作为临时包裹旧 Znawca 的过渡手段。

## 理由

Activity Host 落地「UI 宿主合约」，保证各引擎体验一致、可键盘全操作、符合无障碍要求。

## 影响面

- 前端：Activity Host 组件。
- 各引擎：适配器改为面向 Host 的挂载接口，而非 iframe 通信。

## 后果

- 利：深度集成、统一体验与无障碍。
- 弊：旧 Znawca 首版仍需 iframe 过渡，存在双轨期。
- 回看点：Znawca 剥离 Electron 壳后应尽快迁离 iframe。
