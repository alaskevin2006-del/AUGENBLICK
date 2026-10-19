"""生产模式启动（Windows 用 waitress；Linux 容器内用 gunicorn，见 deploy/Dockerfile.backend）。

用法：python serve.py   （PORT 环境变量改端口，默认 8000）
"""
import os

from waitress import serve

from config.wsgi import application

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"AUGENBLICK 生产模式: http://localhost:{port}")
    serve(application, host="0.0.0.0", port=port, threads=8)
