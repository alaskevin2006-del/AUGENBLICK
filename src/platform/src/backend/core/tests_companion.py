import base64
import io
import json
import math
import struct
import tempfile
import wave
import zipfile
from pathlib import Path
from django.test import SimpleTestCase, TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from openpyxl import Workbook
from .engines.companion import compile_source, score
from .engines.companion_audio import features, compare
from .models import CourseVersion, Enrollment, Submission, Session
import uuid


def wav(frequency=180, seconds=.5):
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        audio.writeframes(b''.join(struct.pack('<h', int(9000 * math.sin(2 * math.pi * frequency * i / 16000))) for i in range(int(16000 * seconds))))
    return output.getvalue()


class CompanionTests(SimpleTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'J0001.wav').write_bytes(wav())

    def compile(self, rows):
        book = Workbook()
        for row in rows:
            book.active.append(row)
        book.save(self.root / 'script.xlsx')
        return compile_source(self.root, {'source': 'script.xlsx'}, lambda p: {'kind': 'audio', 'path': '/media/hash.wav'})

    def row(self, **values):
        row = [None] * 17
        for column, value in values.items():
            row[ord(column) - 65] = value
        return row

    def test_compile_order_checkpoints_and_safe_display(self):
        result = self.compile([self.row(B=1, J='J0001', Q='[bold]Hello[/bold]'), self.row(B=2, H='Y', J='J0001.wav', Q='* world')])
        self.assertEqual(len(result['questions']), 2)
        self.assertEqual([c['id'] for c in result['checkpoints']], [1, 2])
        interaction = result['questions'][1]['interaction']
        self.assertEqual(interaction['displayBefore'][0][0]['text'], 'Hello')
        self.assertNotIn('features', interaction)
        self.assertEqual(interaction['display']['operation'], 'append')

    def test_conflicting_audio_missing_audio_and_bad_checkpoint_rejected(self):
        for rows in [[self.row(E='E0001', J='J0001')], [self.row(H='Y')], [self.row(B=1), self.row(B=1)], [self.row(C=-1)], [self.row(J='../J0001')]]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                self.compile(rows)

    def test_diagnostics_identical_audio_and_noise(self):
        reference = features(wav())
        result = compare(reference, reference)
        self.assertGreater(result['acousticSimilarity'], .98)
        self.assertEqual(result['method'], 'acoustic-dtw-v1')
        self.assertNotIn('phoneme', result)

    def test_voice_score_is_completion_not_pronunciation(self):
        q = self.compile([self.row(H='Y', J='J0001.wav')])['questions'][0]
        result = score(q, json.dumps({'audio': base64.b64encode(wav()).decode()}))
        self.assertEqual(result['score'], 1)
        self.assertEqual(result['assessment'], 'completion-only')
        self.assertIn('diagnostics', result)
        self.assertNotIn('audio', json.dumps(result))
        self.assertTrue(all(d['id'] != 'phoneme' for d in result['dimensions']))

    def test_no_response_recorded_without_pronunciation_grade(self):
        q = self.compile([self.row(H='Y', J='J0001.wav')])['questions'][0]
        result = score(q, '{"noResponse":true}')
        self.assertEqual(result['responseStatus'], 'no-response')
        self.assertEqual(result['dimensions'], [])

    def test_invalid_audio_and_oversize_rejected(self):
        q = self.compile([self.row(H='Y', J='J0001.wav')])['questions'][0]
        for answer in ['{"audio":"not-wav"}', '{}', json.dumps({'audio': 'A' * 2800001})]:
            with self.assertRaises(ValueError):
                score(q, answer)

    def test_duration_limit_and_silent_recording(self):
        q = self.compile([self.row(H='Y', J='J0001.wav')])['questions'][0]
        with self.assertRaises(ValueError):
            score(q, json.dumps({'audio': base64.b64encode(wav(seconds=2)).decode()}))
        silence = io.BytesIO()
        with wave.open(silence, 'wb') as audio:
            audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            audio.writeframes(bytes(16000))
        result = score(q, json.dumps({'audio': base64.b64encode(silence.getvalue()).decode()}))
        self.assertEqual(result['responseStatus'], 'no-response')
        self.assertEqual(result['diagnostics']['acousticSimilarity'], 0)

    def test_nonvoice_ack_and_wipe(self):
        qs = self.compile([self.row(Q='Hi'), self.row(Q='WIPE CLEAN'), self.row(Q='Bye')])['questions']
        self.assertEqual(qs[-1]['interaction']['displayBefore'], [])
        self.assertEqual(score(qs[0], '{"ack":true}')['score'], 1)
        with self.assertRaises(ValueError):
            score(qs[0], '{}')

    def test_corrupt_workbook_and_expanded_budget(self):
        source = self.root / 'broken.xlsx'
        source.write_bytes(b'broken')
        with self.assertRaisesRegex(ValueError, 'invalid XLSX'):
            compile_source(self.root, {'source': source.name}, lambda p: {})
        with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('oversized.xml', bytes(64 * 1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, '64 MiB'):
            compile_source(self.root, {'source': source.name}, lambda p: {})

    def test_row_and_column_budgets(self):
        with self.assertRaisesRegex(ValueError, '17 columns'):
            self.compile([['x'] * 18])
        with self.assertRaisesRegex(ValueError, '2000 rows'):
            self.compile([self.row(Q='x')] * 2001)

    def test_windows_traversal_source_rejected_portably(self):
        with self.assertRaises(ValueError):
            compile_source(self.root, {'source': '..\\outside.xlsx'}, lambda p: {})


class CompanionRoundTripTests(TestCase):
    def test_checkpoint_record_practice_finish_history_without_raw_audio(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / 'J0001.wav').write_bytes(wav())
        book = Workbook()
        book.active.append(['', 1, 0, '', '', '', '', '', '', '', '', '', '', '', '', '', 'Earlier context'])
        book.active.append(['', 2, 0, '', '', '', '', 'Y', 'Hello', 'J0001.wav', '', '', '', '', '', '', 'Hello'])
        book.save(root / 'script.xlsx')
        payload = compile_source(root, {'source': 'script.xlsx'}, lambda p: {'kind':'audio','path':'/media/hash.wav'})
        course = CourseVersion.objects.create(course_version_id='companion@roundtrip',engine='companion',title='Practice',language_code='en',item_count=2,content_hash='c'*64,status='published',payload=payload)
        user = get_user_model().objects.create_user('companion-learner')
        Enrollment.objects.create(user=user,course_version=course)
        client = APIClient(); client.force_authenticate(user)
        blocked = client.post('/api/sessions/', {'courseVersionId':course.pk,'mode':'T'}, format='json')
        self.assertEqual(blocked.status_code, 400)
        response = client.post('/api/sessions/', {'courseVersionId':course.pk,'mode':'L','checkpoint':2}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        snapshot = response.data
        self.assertEqual(snapshot['question']['interaction']['checkpoint'],2)
        self.assertEqual(snapshot['question']['interaction']['displayBefore'][0][0]['text'],'Earlier context')
        self.assertNotIn('referenceText', json.dumps(snapshot))
        session_id, question_id = snapshot['sessionId'], snapshot['question']['id']
        answer = json.dumps({'audio':base64.b64encode(wav()).decode()})
        body = {'questionId':question_id,'answer':answer,'submissionId':str(uuid.uuid4())}
        submitted = client.post(f'/api/sessions/{session_id}/answer/',body,format='json')
        self.assertEqual(submitted.status_code,200,submitted.data)
        self.assertEqual(submitted.data['feedback']['assessment'],'completion-only')
        before = Session.objects.get(pk=session_id).runtime
        repeated = client.post(f'/api/sessions/{session_id}/practice/',{'questionId':question_id,'answer':answer},format='json')
        self.assertEqual(repeated.status_code,200,repeated.data)
        self.assertEqual(before,Session.objects.get(pk=session_id).runtime)
        self.assertEqual(Submission.objects.filter(session_id=session_id).count(),1)
        finished = client.post(f'/api/sessions/{session_id}/finish/',{},format='json')
        self.assertEqual(finished.status_code,200,finished.data)
        history = client.get(f'/api/history/{session_id}/')
        self.assertEqual(history.status_code,200)
        self.assertNotIn(json.loads(answer)['audio'], json.dumps(history.data))
        self.assertNotIn(json.loads(answer)['audio'], Submission.objects.get(session_id=session_id).answer)
