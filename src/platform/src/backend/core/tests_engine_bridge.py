import json
import tempfile
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, override_settings
from rest_framework.test import APIClient
from .models import CourseVersion, Enrollment, Session, Submission
from .runtime import public_question


def payload(engine='anvil'):
    return {'engine': engine, 'items': [{'id': 'a', 'name': 'Question', 'values': {}}],
            'questions': [{'objectId': 'a', 'kind': engine+'-1', 'prompt': 'Choose',
                           'interaction': {'options': [{'id': 'x', 'label': 'X'}]},
                           'solution': {'correct': 'x'}, 'source': 'private.xlsx'}]}


def feedback(q, answer):
    return {'score': 1, 'fullyCorrect': True, 'correctAnswers': ['X'],
            'matched': ['X'], 'missed': [], 'extra': [], 'dimensions': [{'id':'a','label':'A','score':1}]}


class EngineBridgeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('bridge')
        self.client = APIClient(); self.client.force_authenticate(self.user)
        self.course = CourseVersion.objects.create(course_version_id='engine@1', engine='anvil', title='New engine',
            language_code='en', item_count=1, content_hash='f'*64, payload=payload(), status='published')
        Enrollment.objects.create(user=self.user,course_version=self.course)

    def start(self, mode='T'):
        r=self.client.post('/api/sessions/',{'courseVersionId':self.course.pk,'mode':mode},format='json')
        self.assertEqual(r.status_code,201,r.data)
        return r.data

    def test_new_engine_setup_runtime_and_history_use_existing_permissions(self):
        setup=self.client.post(f'/api/courses/{self.course.pk}/setup/',{},format='json')
        self.assertEqual(setup.status_code,200,setup.data)
        self.assertEqual(setup.data['kinds'][0]['value'],'anvil-1')
        s=self.start(); self.assertEqual(s['engine'],'anvil')
        self.assertNotIn('solution',s['question']);self.assertNotIn('source',s['question'])
        with patch('core.engines.registry.get_engine',return_value=SimpleNamespace(score=feedback)):
            r=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",{'questionId':s['question']['id'],'submissionId':str(uuid.uuid4()),'answer':'{"selected":"x"}'},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(r.data['feedback']['dimensions'][0]['score'],1)
        finish=self.client.post(f"/api/sessions/{s['sessionId']}/finish/",{},format='json')
        self.assertEqual(finish.status_code,200)
        detail=self.client.get(f"/api/history/{s['sessionId']}/")
        self.assertEqual(detail.status_code,200)
        self.assertEqual(detail.data['engine'],'anvil')
        self.assertNotIn('solution',json.dumps(detail.data))

    def test_pending_interaction_is_idempotent_and_not_an_item_resolution(self):
        self.course.engine='sokole-oko';self.course.payload=payload('sokole-oko');self.course.save()
        s=self.start('L'); token=str(uuid.uuid4())
        def click(q,answer):
            q['solution']['hits']=q['solution'].get('hits',0)+1
            return {**feedback(q,answer),'pending':True,'found':1}
        body={'questionId':s['question']['id'],'submissionId':token,'answer':'{"x":0.5,"y":0.5}'}
        with patch('core.engines.registry.get_engine',return_value=SimpleNamespace(score=click)):
            first=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",body,format='json')
            second=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",body,format='json')
        self.assertEqual(first.status_code,200,first.data)
        self.assertEqual(first.data,second.data)
        self.assertIsNone(first.data['feedback']);self.assertEqual(first.data['interactionFeedback']['found'],1)
        saved=Session.objects.get(pk=s['sessionId'])
        self.assertEqual(saved.runtime['questions'][s['question']['id']]['solution']['hits'],1)
        self.assertEqual(saved.runtime['review'],[])
        self.assertFalse(saved.events.filter(type='itemResolved').exists())

    def test_companion_formal_test_is_blocked_and_recordings_not_stored(self):
        self.course.engine='companion';self.course.payload=payload('companion');self.course.save()
        r=self.client.post('/api/sessions/',{'courseVersionId':self.course.pk,'mode':'T'},format='json')
        self.assertEqual(r.status_code,400)
        s=self.start('L'); raw='{"audio":"private-audio"}'
        with patch('core.engines.registry.get_engine',return_value=SimpleNamespace(score=feedback)):
            r=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",{'questionId':s['question']['id'],'submissionId':str(uuid.uuid4()),'answer':raw},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertNotIn('private-audio',json.dumps(Session.objects.get(pk=s['sessionId']).runtime))
        self.assertNotIn('private-audio',Submission.objects.get(session_id=s['sessionId']).answer)


class EngineAssetTests(SimpleTestCase):
    def test_public_question_has_strict_allowlist(self):
        q={**payload()['questions'][0],'id':'random','engine':'anvil','acceptedAnswers':['secret'],'privateMask':'secret'}
        result=public_question(q)
        self.assertNotIn('solution',result);self.assertNotIn('privateMask',result);self.assertNotIn('source',result)

    def test_safe_file_rejects_portable_traversal(self):
        from .engines.common import safe_file
        with tempfile.TemporaryDirectory() as folder:
            for name in ('../x','..\\x','C:\\x','https://host/x','/x'):
                with self.assertRaises(ValueError):safe_file(Path(folder),name)

    def test_svg_active_content_is_rejected(self):
        from .engines.common import validate_svg
        with self.assertRaises(ValueError):validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
        with self.assertRaises(ValueError):validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil/x"/></svg>')
        validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0L20 20"/></svg>')

class EngineSelectionTests(SimpleTestCase):
    def test_two_question_banks_have_both_seeded_orders(self):
        from .selection import select_questions
        p=payload();p['items'].append({'id':'b','name':'B','values':{}});p['questions'].append({**p['questions'][0],'objectId':'b'})
        orders={tuple(q['objectId'] for q in select_questions(p,{},seed)[0]) for seed in range(10)}
        self.assertEqual(len(orders),2)
