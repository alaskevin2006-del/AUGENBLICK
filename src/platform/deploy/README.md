# 部署

> 本目录为 Linux/Docker 目标环境（ADR-0006~0008）。**本机无 Docker，compose 链路未实测**；
> 已实测的是 Windows 生产模式（单进程，同一套 settings/wsgi 环境变量路径）。

## A. 本机/Windows 生产模式（已实测，e2e 12/12）

```bash
# 1. 构建前端
cd src/platform/src/frontend && npm run build
# 2. 单进程起站（前端 + API + 媒体同端口 8000）
cd ../backend && DJANGO_DEBUG=0 python serve.py        # Windows（waitress）
# 环境变量：PORT（默认 8000）、DJANGO_SECRET_KEY、DB_ENGINE/DB_*（切 PostgreSQL）
```

## B. Docker Compose（Linux 目标，未实测）

```bash
cd src/platform/deploy
cp .env.example .env   # 填 DB_PASSWORD / DJANGO_SECRET_KEY
docker compose up -d --build
# 导入课程（课程源目录挂到 COURSES_DIR，只读）
docker compose exec backend python manage.py import_znawca /courses/BirdsV2
```

- `web`：Nginx 托管前端构建产物，反代 `/api`、`/media` → backend:8000
- `backend`：gunicorn × 3，启动自动 migrate；媒体存 named volume `media`
- `db`：PostgreSQL 17，named volume `pgdata`
- 迁移到客户环境（Linux x86-64 + Docker/Podman + PG17 + S3 兼容存储）时业务代码零改动；
  对象存储接入（媒体从 /media/ 切到 S3/CDN）是后续独立任务。
