import io
import tempfile
import zipfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from .dev_views import _safe_extract
from .importer import CourseImportError


class UploadSecurityTests(SimpleTestCase):
    def test_traversal_rejected(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("../outside.xlsx", "data")
        with tempfile.TemporaryDirectory() as target, zipfile.ZipFile(data) as archive:
            with self.assertRaises(CourseImportError):
                _safe_extract(archive, Path(target))

    def test_expansion_limit_rejected_before_extract(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("large.xlsx", "data")
        with tempfile.TemporaryDirectory() as target, zipfile.ZipFile(data) as archive:
            archive.infolist()[0].file_size = 1024 * 1024 * 1024 + 1
            with self.assertRaises(CourseImportError):
                _safe_extract(archive, Path(target))
            self.assertEqual(list(Path(target).iterdir()), [])

    @override_settings(DEBUG=False)
    def test_seed_accounts_refused_in_production(self):
        with self.assertRaises(CommandError):
            call_command("seed_users")


class LoginValidationTests(APITestCase):
    def test_non_string_credentials_are_bad_request(self):
        response = self.client.post("/api/auth/login/", {"username": {}, "password": []}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_list_body_is_bad_request(self):
        response = self.client.post("/api/auth/login/", [], format="json")
        self.assertEqual(response.status_code, 400)
