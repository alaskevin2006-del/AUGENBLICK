import io
import tempfile
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import UploadedFile
from django.test import SimpleTestCase

from .dev_views import CourseUploadView, _safe_extract
from .importer import CourseImportError


class UploadLimitTests(SimpleTestCase):
    def upload(self, size):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as z:
            z.writestr('demo_zh.xlsx', 'workbook')
        data.seek(0)
        return UploadedFile(data, name='demo.zip', content_type='application/zip', size=size)

    def test_reported_real_course_size_is_accepted(self):
        # Real failed request: 299037192-byte ZIP, 299037394-byte multipart body.
        with patch('core.dev_views.import_course_dir', return_value={'imported': [], 'warnings': []}) as importer:
            response = CourseUploadView().post(SimpleNamespace(FILES={'file': self.upload(299037192)}))
        self.assertEqual(response.status_code, 200)
        importer.assert_called_once()

    def test_512_mib_boundary_is_accepted_but_larger_is_rejected(self):
        with patch('core.dev_views.import_course_dir', return_value={'imported': [], 'warnings': []}):
            response = CourseUploadView().post(SimpleNamespace(FILES={'file': self.upload(512 * 1024 * 1024)}))
            self.assertEqual(response.status_code, 200)
            response = CourseUploadView().post(SimpleNamespace(FILES={'file': self.upload(512 * 1024 * 1024 + 1)}))
            self.assertEqual(response.status_code, 413)

    def test_windows_traversal_is_rejected_on_every_host(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as z:
            z.writestr('..\\outside.xlsx', 'data')
        with tempfile.TemporaryDirectory() as target, zipfile.ZipFile(data) as z:
            with self.assertRaises(CourseImportError):
                _safe_extract(z, Path(target))

    def test_unsupported_compression_returns_actionable_error(self):
        with patch('core.dev_views._safe_extract', side_effect=NotImplementedError('unsupported method')):
            response = CourseUploadView().post(SimpleNamespace(FILES={'file': self.upload(100)}))
        self.assertEqual(response.status_code, 400)
        self.assertIn('ZIP', response.data['detail'])
