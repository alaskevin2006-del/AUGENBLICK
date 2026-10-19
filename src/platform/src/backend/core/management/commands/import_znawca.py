"""导入 Znawca V2 课程目录为不可变 CourseVersion（核心逻辑在 core.importer）。

用法：python manage.py import_znawca <课程目录>
目录内每个 `基础名_语言码.xlsx` 工作簿产出一个 CourseVersion；双题干缺失等
error 级问题导致导入失败（退出码非 0），媒体缺失/列内混合只 warning。
"""
from django.core.management.base import BaseCommand, CommandError

from core.importer import CourseImportError, import_course_dir


class Command(BaseCommand):
    help = "导入 Znawca V2 课程目录（每个语言工作簿 = 一个 CourseVersion）"

    def add_arguments(self, parser):
        parser.add_argument("course_dir", type=str)

    def handle(self, *args, **options):
        try:
            result = import_course_dir(options["course_dir"])
        except CourseImportError as e:
            for msg in e.errors:
                self.stderr.write(self.style.ERROR(f"[error] {msg}"))
            raise CommandError(e.detail)

        for msg in result["warnings"]:
            self.stderr.write(self.style.WARNING(f"[warning] {msg}"))
        for entry in result["imported"]:
            if entry["reused"]:
                self.stdout.write(f"[复用] {entry['courseVersionId']}（同 content_hash，跳过）")
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"[导入] {entry['courseVersionId']}  title='{entry['title']}'  "
                    f"items={entry['itemCount']}"
                ))
