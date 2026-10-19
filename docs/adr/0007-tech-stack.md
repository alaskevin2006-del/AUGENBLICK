# ADR-0007: 技术栈定稿

- 状态：已接受
- 日期：2026-08-25
- 决策人：恺欣

## 背景

平台腿技术选型长期挂「待定」。当前规模几十到几百活跃用户，需兼顾开发效率、Python 生态（Excel/语音）、可迁移性（客户服务器）与双品牌部署。

## 决策

| 层级 | 选型 |
|---|---|
| 前端 | React + TypeScript + Vite（构建后纯静态） |
| 前端配套 | React Router / TanStack Query / i18next / CSS Variables + Tailwind/Radix |
| 后端 | Python + Django 5.2 LTS + Django REST Framework |
| 后台任务 | Celery + Redis-compatible broker（导入/校验/编译/转码/语音分析） |
| 数据库 | PostgreSQL 17（关系表 + JSONB 存引擎编译载荷） |
| 文件存储 | S3 兼容对象存储（腾讯 COS → 客户 S3/MinIO/Ceph，只改 endpoint/密钥） |
| 部署 | Linux + Docker Compose + Nginx（当前规模无需 K8s） |

## 理由

- React 适配交互题目/SVG/音视频/RTL 与统一 Activity Host；静态产物迁移最简单。
- Django 提供成熟账户/权限/ORM/事务/后台，且 Python 天然适合 Excel 解析与 Companion 语音分析。
- PostgreSQL 事务 + JSONB 覆盖关系密集 + 引擎数据灵活两难。
- S3 兼容存储 + Docker Compose 保证「腾讯云 → 客户服务器」零业务代码迁移。

## 不采纳

- Next.js（无 SEO/SSR 需求，徒增 Node 生产服务）
- FastAPI（缺完整后台/ORM/内容工作流）
- NestJS（Excel/音频仍依赖 Python，且要自建后台）
- MongoDB（关系密集，事务与约束不如 PostgreSQL）
- 微服务/K8s（当前规模不需要；Companion 语音仅独立 Worker，算力瓶颈再拆）

## 影响面

- 平台腿：全栈按此栈搭建。
- 迁移约定：客户提供 Linux x86-64 + Docker/Podman + PostgreSQL 17+ + S3 兼容存储。
- 约束：核心代码禁用 TDSQL 专有能力、腾讯云函数、专有消息队列、COS 专用 SDK。

## 后果

- 利：迁移零业务代码改动；运维简单。
- 弊：Django Admin 仅用于账号/权限/故障，内容工作流须独立做 React「Course Studio」。
- 回看点：生产若主要服务波兰/EU 学员，需先做数据驻留与跨境合规评估（见 OPEN-QUESTIONS）。
