import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from openpyxl import Workbook

from .importer import import_course_dir
from .models import CourseVersion


class ContentVersionTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "media").mkdir()
        (self.source / "media" / "bird.png").write_bytes(b"first-image")
        wb = Workbook()
        wb.active.append(["Birds", "Name / Identify", "Color / Which bird"])
        wb.active.append(["bird.png", "Robin", "Red"])
        wb.save(self.source / "birds_en.xlsx")
        self.settings = override_settings(MEDIA_ROOT=self.root / "published")
        self.settings.enable()
        self.addCleanup(self.settings.disable)

    def version(self):
        return import_course_dir(self.source)["imported"][0]

    def test_unchanged_content_reuses_version(self):
        first = self.version()
        second = self.version()
        self.assertEqual(first["courseVersionId"], second["courseVersionId"])
        self.assertTrue(second["reused"])

    def test_same_named_media_change_creates_version_and_preserves_old(self):
        first = self.version()
        (self.source / "media" / "bird.png").write_bytes(b"second-image")
        second = self.version()
        self.assertNotEqual(first["courseVersionId"], second["courseVersionId"])
        url = CourseVersion.objects.get(pk=first["courseVersionId"]).payload["items"][0]["media"][0]["url"]
        self.assertEqual((self.root / "published" / url.removeprefix("/media/")).read_bytes(), b"first-image")

    def test_public_asset_urls_hide_source_names_and_speech_coordinates(self):
        speech = self.source / "speech" / "en"
        speech.mkdir(parents=True)
        (speech / "B2.mp3").write_bytes(b"spoken-answer")
        version = self.version()
        payload = CourseVersion.objects.get(pk=version["courseVersionId"]).payload
        image = payload["items"][0]["media"][0]["url"]
        audio = payload["speech"][0]["url"]
        self.assertNotIn("bird.png", image)
        self.assertNotIn("B2", audio)
        self.assertNotIn("speech/en", audio)
        self.assertEqual((self.root / "published" / audio.removeprefix("/media/")).read_bytes(), b"spoken-answer")

    def test_same_named_speech_change_creates_version(self):
        speech = self.source / "speech" / "en"
        speech.mkdir(parents=True)
        (speech / "B2.mp3").write_bytes(b"first")
        first = self.version()
        (speech / "B2.mp3").write_bytes(b"second")
        self.assertNotEqual(first["courseVersionId"], self.version()["courseVersionId"])

    def test_same_named_feedback_change_creates_version(self):
        sound = self.source / "correct 00.mp3"
        sound.write_bytes(b"first")
        first = self.version()
        sound.write_bytes(b"second")
        self.assertNotEqual(first["courseVersionId"], self.version()["courseVersionId"])
