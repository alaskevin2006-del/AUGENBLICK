"""开发者课程上传（契约§九）：POST /api/dev/courses/upload/，需认证 + is_staff。"""
import tempfile
import zipfile
import stat
from pathlib import Path, PurePosixPath, PureWindowsPath

from rest_framework import status as http
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .importer import CourseImportError, import_course_dir

MAX_UPLOAD_BYTES = 512 * 1024 * 1024
MAX_EXPANDED_BYTES = 2 * 1024 * 1024 * 1024


class IsStaffDeveloper(BasePermission):
    """开发者 = User.is_staff；已认证但非 staff → 403。"""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class CourseUploadView(APIView):
    """multipart 字段 file：课程 ZIP → 解压到临时目录 → 同步走 import_znawca 同一导入逻辑。"""

    permission_classes = [IsAuthenticated, IsStaffDeveloper]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"error": "缺少文件", "detail": "multipart 字段 'file' 缺失。"},
                            status=http.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_UPLOAD_BYTES:
            return Response({"error": "文件过大", "detail": "ZIP 超过 512 MiB 限制。"},
                            status=http.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        try:
            with tempfile.TemporaryDirectory(prefix="augenblick-upload-") as tmp:
                tmp_path = Path(tmp)
                try:
                    with zipfile.ZipFile(upload) as zf:
                        _safe_extract(zf, tmp_path)
                except zipfile.BadZipFile:
                    return Response({"error": "无效的 ZIP", "detail": "上传文件不是合法的 ZIP 压缩包。"},
                                    status=http.HTTP_400_BAD_REQUEST)
                except (NotImplementedError, RuntimeError):
                    return Response({"error": "不支持的压缩格式", "detail": "请使用普通 ZIP（Deflate 或不压缩），不要加密。"},
                                    status=http.HTTP_400_BAD_REQUEST)
                result = import_course_dir(_locate_course_dir(tmp_path))
        except CourseImportError as e:
            return Response({"error": e.error, "detail": e.detail}, status=http.HTTP_400_BAD_REQUEST)
        return Response(result)


def _safe_extract(zf: zipfile.ZipFile, target: Path):
    """解压并防 zip-slip：成员路径必须落在目标目录内。"""
    root = target.resolve()
    members = zf.infolist()
    if len(members) > 20000 or sum(m.file_size for m in members) > MAX_EXPANDED_BYTES:
        raise CourseImportError("ZIP 过大", "解压内容不得超过 2 GiB 或 20000 个文件。")
    for member in members:
        if member.flag_bits & 1 or stat.S_ISLNK(member.external_attr >> 16):
            raise CourseImportError("非法的 ZIP", "不支持加密文件或符号链接。")
        portable = member.filename.replace("\\", "/")
        if PureWindowsPath(portable).drive or PurePosixPath(portable).is_absolute() or ".." in PurePosixPath(portable).parts:
            raise CourseImportError("非法的 ZIP", f"ZIP 内含越界路径：{member.filename}")
        dest = (root / member.filename).resolve()
        if dest != root and root not in dest.parents:
            raise CourseImportError("非法的 ZIP", f"ZIP 内含越界路径：{member.filename}")
    zf.extractall(root)


def _locate_course_dir(root: Path) -> Path:
    """容忍 ZIP 根下包一层子目录：根无 xlsx 且只有一个含 xlsx 的子目录时下钻。"""
    def has_xlsx(d: Path) -> bool:
        return any(p.is_file() and p.suffix.lower() == ".xlsx" and not p.name.startswith("~$")
                   for p in d.iterdir())

    if has_xlsx(root):
        return root
    subdirs = [p for p in root.iterdir() if p.is_dir() and p.name != "__MACOSX"]
    if len(subdirs) == 1 and has_xlsx(subdirs[0]):
        return subdirs[0]
    return root  # 交给 importer 报"没有工作簿"
