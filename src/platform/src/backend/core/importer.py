"""Znawca V2 课程目录导入核心逻辑（management command 与上传视图共用）。

import_course_dir(course_dir) 同步导入目录内每个 `基础名_语言码.xlsx` 工作簿为一个
不可变 CourseVersion；同 content_hash 重复导入直接复用（reused=True）。
解析/校验失败抛 CourseImportError(error, detail)。
"""
import hashlib
import re
import shutil
from pathlib import Path

import openpyxl
from django.conf import settings

from core.models import CourseVersion

MEDIA_EXTENSIONS = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
    ".bmp": "image", ".gif": "image",
    ".mp3": "audio", ".wav": "audio", ".m4a": "audio",
    ".mp4": "video",
}
LANGUAGE_SUFFIX = re.compile(r"^(.+?)_([A-Za-z]{2,3})$")
FEEDBACK_PATTERN = re.compile(r"^(correct|incorrect).*\.mp3$", re.IGNORECASE)


class CourseImportError(Exception):
    """导入失败。error=简述，detail=逐条 error 明细（已带工作簿名前缀）。"""

    def __init__(self, error: str, detail: str, errors: list | None = None):
        super().__init__(detail)
        self.error = error
        self.detail = detail
        self.errors = errors or []


def normalize_key(value: str) -> str:
    """trim → 小写 → 空白串转 "-" → 去标点（保留 Unicode 字母数字与下划线；
    严格 [a-z0-9-] 会使中文名坍缩为空串，故对齐桌面 normalizeKey 的实际效果）。"""
    value = re.sub(r"\s+", "-", value.strip().lower())
    return re.sub(r"[^\w-]", "", value)


def split_values(value: str) -> list:
    return [part.strip() for part in value.split(";") if part.strip()]


def parse_column_title(title: str) -> dict:
    """`#`/`$`/`*` 前缀 + `正向 / 反向` 双题干（对齐桌面 parseColumnTitle）。"""
    rest = title.strip()
    filter_only = rest.startswith("#")
    if filter_only:
        rest = rest[1:].strip()
    role = "both"
    if rest.startswith("$"):
        role, rest = "question-only", rest[1:].strip()
    elif rest.startswith("*"):
        role, rest = "answer-only", rest[1:].strip()
    sep = rest.find("/")
    forward = rest[:sep].strip() if sep >= 0 else ""
    reverse = rest[sep + 1:].strip() if sep >= 0 else ""
    return {"title": rest, "filterOnly": filter_only, "role": role,
            "forward": forward or None, "reverse": reverse or None}


def cell_media_category(raw: str):
    """按扩展名语法判定：("media", kind, 变体列表) | ("text", None, []) | ("mixed", None, [])。"""
    parts = [p.strip() for p in raw.strip().split("/") if p.strip()]
    if not parts:
        return ("text", None, [])
    kinds = [MEDIA_EXTENSIONS.get(Path(p).suffix.lower()) for p in parts]
    if all(k is None for k in kinds):
        return ("text", None, [])
    if any(k is None for k in kinds) or len(set(kinds)) > 1:
        return ("mixed", None, [])
    return ("media", kinds[0], parts)


def import_course_dir(course_dir) -> dict:
    """导入一个 Znawca V2 课程目录。

    返回 {"imported": [{courseVersionId, title, languageCode, itemCount, reused, warnings}],
          "warnings": ["<工作簿名>: <warning>", ...]}；失败抛 CourseImportError。
    """
    course_dir = Path(course_dir)
    if not course_dir.is_dir():
        raise CourseImportError("课程目录不存在", f"课程目录不存在：{course_dir}")

    workbooks = sorted(
        p for p in course_dir.iterdir()
        if p.is_file() and p.suffix.lower() == ".xlsx" and not p.name.startswith("~$")
    )
    if not workbooks:
        raise CourseImportError("没有工作簿", f"目录内没有 .xlsx 工作簿：{course_dir}")

    parsed = [(p, LANGUAGE_SUFFIX.match(p.stem)) for p in workbooks]
    if not all(m for _, m in parsed):
        raise CourseImportError(
            "工作簿命名不支持",
            "存在无语言后缀的工作簿，仅支持 V2 `基础名_语言码.xlsx` 命名。",
        )

    media_index = _build_media_index(course_dir / "media")
    feedback = sorted(
        p.name for p in course_dir.iterdir() if p.is_file() and FEEDBACK_PATTERN.match(p.name)
    )

    imported, all_warnings = [], []
    for path, match in parsed:
        base, lang = match.group(1).strip(), match.group(2)
        entry = _import_workbook(course_dir, path, base, lang, media_index, feedback)
        imported.append({k: v for k, v in entry.items() if k != "warnings"})
        all_warnings.extend(f"{path.name}: {w}" for w in entry["warnings"])
    return {"imported": imported, "warnings": all_warnings}


def _build_media_index(media_dir: Path) -> dict:
    """文件名（小写）→ 原始文件名；目录不存在视为无媒体。"""
    if not media_dir.is_dir():
        return {}
    return {p.name.lower(): p.name for p in media_dir.iterdir() if p.is_file()}


def _content_hash(workbook: Path, media_index: dict, speech_files: list, feedback: list, lang: str) -> str:
    """Hash names and bytes, including all assets; same-name replacements are new versions."""
    h = hashlib.sha256()
    root = workbook.parent
    paths = [workbook] + [root / "media" / n for n in media_index.values()]
    paths += [root / "speech" / lang / n for n in speech_files]
    paths += [root / n for n in feedback]
    for path in sorted(paths, key=lambda p: p.relative_to(root).as_posix()):
        name = path.relative_to(root).as_posix().encode("utf-8")
        h.update(len(name).to_bytes(8, "big"))
        h.update(name)
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        h.update(digest.digest())
    return h.hexdigest()


def _import_workbook(course_dir, workbook, base, lang, media_index, feedback) -> dict:
    errors, warnings = [], []

    speech_dir = course_dir / "speech" / lang
    speech_files = (
        sorted(p.name for p in speech_dir.iterdir()
               if p.is_file() and MEDIA_EXTENSIONS.get(p.suffix.lower()) == "audio")
        if speech_dir.is_dir() else []
    )

    content_hash = _content_hash(workbook, media_index, speech_files, feedback, lang)
    version_id = f"{normalize_key(f'{base}_{lang}')}@{content_hash}"

    # 版本不可变：同 hash 重复导入直接复用
    existing = CourseVersion.objects.filter(content_hash=content_hash).first()
    if existing:
        return {
            "courseVersionId": existing.course_version_id,
            "title": existing.title,
            "languageCode": existing.language_code,
            "itemCount": existing.item_count,
            "reused": True,
            "warnings": [],
        }

    wb = openpyxl.load_workbook(workbook, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = [["" if c is None else str(c) for c in row] for row in ws.iter_rows(values_only=True)]
    wb.close()

    def cell(row, col):  # row/col 均 1 起
        if row - 1 < len(rows) and col - 1 < len(rows[row - 1]):
            return re.sub(r"\s+", " ", rows[row - 1][col - 1]).strip()
        return ""

    max_col = max((len(r) for r in rows), default=0)
    title = cell(1, 1)

    # 表头：B1 名称列 + C1 起属性列；非筛选列双题干必填
    columns = []
    for col in range(2, max_col + 1):
        header = cell(1, col)
        if not header:
            errors.append(f"第 1 行第 {col} 列表头为空。")
            continue
        parsed = parse_column_title(header)
        if not parsed["filterOnly"] and (parsed["forward"] is None or parsed["reverse"] is None):
            errors.append(f"列表头 '{header}' 缺 '正向 / 反向' 双题干或一侧为空。")
        columns.append({"index": col, **parsed})

    # 逐行解析 items
    items = []
    seen_ids = {}
    column_kinds = {}  # 列号 → {类别: 首行行号}，用于列内混合检查
    for row_no in range(2, len(rows) + 1):
        if all(not cell(row_no, c) for c in range(1, max_col + 1)):
            continue
        name = cell(row_no, 2)
        if not name:
            errors.append(f"第 {row_no} 行 B 列（名称）为空。")
            continue
        item_id = normalize_key(name)
        if item_id in seen_ids:
            errors.append(f"第 {row_no} 行名称 '{name}' 与第 {seen_ids[item_id]} 行重复。")
            continue
        seen_ids[item_id] = row_no

        def resolve_cell(raw, col_no):
            """返回 (类别, 文本值列表, 媒体资产列表)。"""
            category, kind, parts = cell_media_category(raw)
            if category != "media":
                return ("text" if category == "text" else "mixed", split_values(raw), [])
            assets = []
            for ref in parts:
                real = media_index.get(ref.lower())
                if not real:
                    warnings.append(f"第 {row_no} 行第 {col_no} 列引用的媒体 '{ref}' 不在 media/ 中，已跳过。")
                    continue
                assets.append({"kind": kind, "url": f"/media/{version_id}/{real}", "_file": real})
            return (kind if assets else "text", [], assets)

        main_media, main_kind = [], None
        raw_main = cell(row_no, 1)
        if raw_main:
            main_kind, _, main_media = resolve_cell(raw_main, 1)
            column_kinds.setdefault(1, set()).add(main_kind)

        values, cell_media = {}, {}
        for column in columns:
            if column["index"] < 3:
                continue
            raw = cell(row_no, column["index"])
            if not raw:
                continue
            kind, texts, assets = resolve_cell(raw, column["index"])
            column_kinds.setdefault(column["index"], set()).add(kind)
            if assets:
                cell_media[column["title"]] = [{k: v for k, v in a.items() if k != "_file"} for a in assets]
            else:
                values[column["title"]] = texts

        items.append({
            "id": item_id,
            "name": name,
            "sourceRow": row_no,
            "values": values,
            "media": [{k: v for k, v in a.items() if k != "_file"} for a in main_media],
            "cellMedia": cell_media,
        })

    # 列内混合（媒体列与文本列不混）：warning 不阻断
    for col_no, kinds in column_kinds.items():
        kinds.discard("mixed")
        if len(kinds) > 1:
            warnings.append(f"第 {col_no} 列内混合了 {sorted(kinds)}，建议拆列。")

    if not items:
        errors.append("工作簿没有任何有效 item。")

    if errors:
        prefixed = [f"{workbook.name}: {msg}" for msg in errors]
        raise CourseImportError(
            f"导入失败：{workbook.name}",
            f"导入失败：{workbook.name} 存在 {len(errors)} 个 error。" + "；".join(prefixed),
            errors=prefixed,
        )

    # 复制媒体到 backend/media/<courseVersionId>/（源目录只读）
    target = Path(settings.MEDIA_ROOT) / version_id
    target.mkdir(parents=True, exist_ok=True)
    for real in media_index.values():
        shutil.copy2(course_dir / "media" / real, target / real)
    for name in speech_files:
        dest = target / "speech" / lang
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(speech_dir / name, dest / name)
    for name in feedback:
        shutil.copy2(course_dir / name, target / name)

    payload = {
        "schemaVersion": "0.3",
        "engine": "znawca",
        "courseVersionId": version_id,
        "title": title or base,
        "languageCode": lang,
        "formatVersion": "v2",
        "columns": columns,
        "items": items,
        "speech": [
            {"coord": Path(n).stem, "url": f"/media/{version_id}/speech/{lang}/{n}"}
            for n in speech_files
        ],
        "feedbackSounds": {
            "correct": [f"/media/{version_id}/{n}" for n in feedback if n.lower().startswith("correct")],
            "incorrect": [f"/media/{version_id}/{n}" for n in feedback if n.lower().startswith("incorrect")],
        },
    }
    CourseVersion.objects.create(
        course_version_id=version_id,
        title=payload["title"],
        language_code=lang,
        item_count=len(items),
        payload=payload,
        content_hash=content_hash,
    )
    return {
        "courseVersionId": version_id,
        "title": payload["title"],
        "languageCode": lang,
        "itemCount": len(items),
        "reused": False,
        "warnings": warnings,
    }
