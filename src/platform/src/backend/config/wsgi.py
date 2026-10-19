import os

from django.conf import settings
from django.core.wsgi import get_wsgi_application
from whitenoise import WhiteNoise

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

# 生产单进程部署：同端口托管前端构建产物（/）与课程媒体（/media/）。
# /api 等无文件命中的路径自动回落到 Django。开发 runserver 走 urls.py 的 static()，互不影响。
application = WhiteNoise(application, index_file=True)
if settings.FRONTEND_DIST.exists():
    application.add_files(str(settings.FRONTEND_DIST), prefix="")
if settings.MEDIA_ROOT.exists():
    application.add_files(str(settings.MEDIA_ROOT), prefix="media/")
