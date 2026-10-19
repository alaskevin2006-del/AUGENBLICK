"""配置：默认开发（SQLite + DEBUG）；环境变量切换生产（PostgreSQL + 静态/媒体由 WhiteNoise 托管）。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "core",
]

MIDDLEWARE = [
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# DB_ENGINE=postgresql 时走 PostgreSQL 17（ADR-0006），否则开发默认 SQLite
if os.environ.get("DB_ENGINE") == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "augenblick"),
            "USER": os.environ.get("DB_USER", "augenblick"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("DB_SQLITE", str(BASE_DIR / "db.sqlite3")),
        }
    }

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "UTC"
USE_TZ = True

STATIC_URL = "static/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", str(BASE_DIR / "media")))
MEDIA_URL = "/media/"

# 前端构建产物（生产模式由 WhiteNoise 在同端口托管，单进程部署）
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist")))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Token 认证（契约§八）：除 login 外所有 /api/ 端点要求认证
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"],
}

# 上传走临时文件而非内存（课程 ZIP ≤200MB，契约§九）
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
