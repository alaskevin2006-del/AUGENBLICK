# AUGENBLICK 隔离部署

本目录提供首个在线切片的部署包装。现有逸学和未来 LumaRead 共用服务器时，各项目拥有独立端口、Compose 项目、网络和数据卷。这里所有命令只操作 **augenblick**，不修改其他项目代码、容器或代理配置。

## 当前入口

- 外网：`https://124.221.230.69:18443/`，使用证书 SAN 包含该 IP 的可信证书。
- 内部：`127.0.0.1:18080`，仅用于本机验证。HTTP 登录入口不得绑定公网。
- 现有 80/443 服务保持原样；不使用域名伪装、子路径路由或共享 Docker 网络。
- 默认端口均可通过环境变量改变，先用 `ss -ltn` 检查占用，再为 **18443/TCP** 单独配置腾讯云安全组及主机防火墙；不要修改现有规则。
- PostgreSQL 17 和 Gunicorn 不映射宿主端口。持久数据仅在 `augenblick_pgdata` / `augenblick_media`。
- 生产强制 `DEBUG=0`、明确 hosts 和独立随机密钥，无默认账号或密码。
- 内存上限总计约 1.4 GiB（数据库 512 MiB、后端 768 MiB、Nginx 128 MiB），日志轮转。构建前端在本机完成。

Nginx 直接只读挂载媒体卷，因此上传后的图片、音频无需重启即可显示。上传限制为 201 MiB 请求体，对应应用的 200 MiB ZIP 限制加 multipart 开销。现阶段媒体仍是公开 URL，不宣称实现付费私有对象存储或签名 URL。

## 发布准备

推荐目录：

```text
/opt/augenblick/releases/<git-SHA>/  # 本次源码 + 对应 dist
/opt/augenblick/current            # 指向当前验证完成的发布目录
/opt/augenblick/shared/.env        # chmod 600，不进 Git
/opt/augenblick/courses/           # 只读课程导入源
/opt/augenblick/backups/           # chmod 700，数据库+媒体备份
```

本机在对应提交运行前端 `npm ci`、`npm run build`，上传该提交源码及 `src/platform/src/frontend/dist`；排除 node_modules、开发数据库、.env、密钥、本地媒体。Docker 前端预构建模式只复制产物，不在服务器跑 Node。后端镜像单独安装 Python 依赖。全源码 Docker 构建可单独使用主 Compose 文件；生产辅助脚本固定使用预构建与 TLS 两个 override。

复制 `.env.example` 到共享配置，生成独立随机值，例如各自执行 `openssl rand -hex 32` 填 DB_PASSWORD 和 DJANGO_SECRET_KEY。RELEASE_TAG 使用已验收 Git SHA。不要把秘密输出到日志，配置文件权限设为 600；禁止将示例空值或任意开发密钥用于生产。

TLS 只读挂载整棵证书目录以解析 live/ 相对软链接。示例复用已有 IP 证书；**不改变原证书、私钥、续期任务或逸学配置**。每个 TLS 容器都需能读取证书私钥，限制服务器与 Docker 管理权限。确认 SAN 和有效期后再启动。现有证书轮换由原任务负责，AUGENBLICK 的独立 timer 每 6 小时验证自己的 Nginx 配置并平滑重载，最多滞后约 6 小时；原续期失败仍需运维处理。

## 初次启动

以下在**目标发布目录的 src/platform/deploy** 执行，`compose.sh` 固定项目名、明确文件与共享配置，避免目录名变化生成另一套数据卷。

```sh
sh compose.sh config --quiet
sh compose.sh build backend web
sh compose.sh up -d --wait db
sh compose.sh run --rm --no-deps backend python manage.py migrate --noinput
sh compose.sh up -d --no-build --wait --wait-timeout 180 backend web
sh compose.sh exec -T web nginx -t
curl --fail http://127.0.0.1:18080/healthz
curl --fail -H 'Host: 124.221.230.69' http://127.0.0.1:18080/api/health/
curl --fail https://124.221.230.69:18443/api/health/
sh compose.sh exec backend python manage.py createsuperuser
# 可选导入：目录实际存在后执行
sh compose.sh exec backend python manage.py import_znawca /courses/BirdsV2
```

账号通过交互命令设置独立密码。验证登录、课程、作答、图片/音频、刷新恢复；检查现有逸学入口与运行容器前后没有改变。TLS 外网验收必须从另一网络完成，禁止 `curl -k` 替代证书信任验证。

验收成功后，让 current 指向本次发布目录（若已有 current，先记录旧目标）：

```sh
# release_dir 必须由操作者设为已经验证的 /opt/augenblick/releases/<SHA>
ln -sfn "$release_dir" /opt/augenblick/current
install -m 644 augenblick-cert-reload.service augenblick-cert-reload.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now augenblick-cert-reload.timer
systemctl start augenblick-cert-reload.service
systemctl status augenblick-cert-reload.timer --no-pager
```

## 更新与回滚

保留旧 release 目录、旧镜像标签和旧环境文件副本。每次 schema 迁移前备份数据库及媒体，先停本项目 web/backend 以得到一致快照；数据库保持运行。下面只会影响 AUGENBLICK，更新窗口内本项目暂不可用。

```sh
umask 077
backup_dir="/opt/augenblick/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
sh compose.sh stop web backend
sh compose.sh exec -T db pg_dump -U augenblick -d augenblick -Fc > "$backup_dir/database.dump"
sh compose.sh run --rm -T --no-deps --user root backend tar -C /data/media -czf - . > "$backup_dir/media.tar.gz"
cp /opt/augenblick/shared/.env "$backup_dir/release.env"
```

在新 release 下先 build，然后 migrate、up、检查，再切 current。构建失败时旧环境仍可用；已停止服务则从旧 release 运行 `sh compose.sh up -d --no-build --wait backend web` 恢复。

仅当数据库迁移兼容旧代码时，回滚共享 .env 的 RELEASE_TAG 为旧 SHA，再从旧 release 运行：

```sh
sh compose.sh up -d --no-build --wait --wait-timeout 180 backend web
```

如迁移不兼容，先停止本项目 web/backend，明确接受恢复备份会丢失备份后的新增数据，再执行数据库恢复。先保留当前失败状态的备份；不要自动执行 schema 降级。

```sh
# backup_dir 必须是已校验完整、与旧代码对应的备份目录
sh compose.sh exec -T db pg_restore -U augenblick -d augenblick --clean --if-exists --no-owner < "$backup_dir/database.dump"
# 媒体版本不可变；补回备份即可，无需删除当前媒体卷
sh compose.sh run --rm -T --no-deps --user root backend tar -C /data/media -xzf - < "$backup_dir/media.tar.gz"
# 还原旧 .env / RELEASE_TAG、从旧 release 启动并恢复 current
sh compose.sh up -d --no-build --wait --wait-timeout 180 backend web
```

不要运行无目标的 `docker compose down`、`docker system prune` 或删除卷；不要对逸学/LumaRead 执行停止、迁移、构建或清理。

## 验证边界

本机无 Docker 时只能静态审查配置，不能宣称容器部署通过。服务器部署必须实际运行 `config --quiet`、镜像构建、迁移、readiness、Nginx 配置检查与 HTTPS 外网检查。数据库健康检查 + API 健康检查 + Nginx liveness 分别覆盖依赖层；后台进程返回健康不代表产品工作流验收通过。
