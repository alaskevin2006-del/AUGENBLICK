"""Create a small, explicitly labelled, text-only demo through the real importer."""
import tempfile
from pathlib import Path

from django.core.management.base import BaseCommand
from openpyxl import Workbook

from core.importer import import_course_dir


class Command(BaseCommand):
    help = "Create a small vocabulary demo; never edits existing course versions."

    def handle(self, *args, **options):
        with tempfile.TemporaryDirectory(prefix="augenblick-demo-") as temp:
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(["基础词汇 · 演示课 / Vocabulary demo", "名称 / 请写出中文名称", "英文是什么？ / 对应的中文是什么？"])
            for name, english in [("苹果", "apple"), ("梨", "pear"), ("橙子", "orange"), ("葡萄", "grape"), ("草莓", "strawberry")]:
                sheet.append(["", name, english])
            workbook.save(Path(temp) / "vocabulary_zh.xlsx")
            result = import_course_dir(temp)
        self.stdout.write(self.style.SUCCESS(result["imported"][0]["courseVersionId"]))
