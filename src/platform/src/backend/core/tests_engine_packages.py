"""Real ZIP upload to authenticated runtime for every added engine."""
import base64
import io
import json
import tempfile
import uuid
import zipfile
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from openpyxl import Workbook
from PIL import Image
from rest_framework.test import APIClient
from .models import CourseVersion,Session
from .tests_companion import wav


class EnginePackageTests(TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        override=override_settings(MEDIA_ROOT=self.temp.name);override.enable();self.addCleanup(override.disable)
        self.client=APIClient();self.client.force_authenticate(get_user_model().objects.create_user('engine-author',is_staff=True))

    def test_downloadable_author_templates_import_as_drafts(self):
        for engine in ['anvil','ekspert','sokole-oko','companion']:
            with self.subTest(engine=engine):
                archive=(Path(__file__).parent/'fixtures'/f'{engine}.zip').read_bytes()
                result=self.client.post('/api/dev/courses/upload/',{'file':SimpleUploadedFile(f'{engine}.zip',archive)},format='multipart')
                self.assertEqual(result.status_code,200,result.data)
                course=CourseVersion.objects.get(pk=result.data['imported'][0]['courseVersionId'])
                self.assertEqual(course.engine,engine)
                self.assertEqual(course.status,'draft')
                self.assertTrue(course.payload['questions'])

    def upload(self,engine):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            manifest={'engine':engine,'title':engine,'languageCode':'en'}
            Image.new('RGB',(40,40),'white').save(root/'scene.png')
            (root/'J0001.wav').write_bytes(wav())
            if engine=='anvil':
                manifest['source']='source.xlsx';book=Workbook();s=book.active
                for row in [ ['difficulty','type','stimulus','prompt','option1','option2','option3'],
                    [1,1,'scene.png','','white','black'],[1,2,'scene.png','','yes','no'],[None,None,None,'White?','yes'],
                    [1,3,'scene.png','Color?','white','black'],[1,4,'A [white;black] image'],[1,5,'A [~white;black] image'],
                    [1,6,'*','Match','a * A','b * B'],[1,7,'Which?','','scene.png','other.png'],[1,8,'*','','white * scene.png','black * other.png'],[1,9,'J0001.wav','Which?','scene.png','other.png']]:s.append(row)
                Image.new('RGB',(40,40),'black').save(root/'other.png');book.save(root/'source.xlsx')
            elif engine=='ekspert':
                data={'module':{'id':'shapes','axes':[{'id':'color','type':'enum','values':['white','black']},{'id':'filled','type':'boolean'}]},'records':[{'id':'shape','name':'Shape','axes':{'color':'white','filled':True},'media':{'img':'scene.png'}}]}
                (root/'data.json').write_text(json.dumps(data))
            elif engine=='sokole-oko':
                for n,x in enumerate([5,25]):
                    mask=Image.new('L',(40,40),255)
                    for px in range(x,x+5):
                        for py in range(5,10):mask.putpixel((px,py),0)
                    mask.save(root/f'scene--answer{n+1}.png')
                (root/'scene.txt').write_text('EN: Find both')
                (root/'scene--answer1.txt').write_text('EN: Find first')
            else:
                manifest['source']='script.xlsx';book=Workbook();book.active.append([None,1,None,None,None,None,None,None,'Listen','J0001.wav',None,None,None,None,None,None,'Listen']);book.active.append([None,2,None,None,None,None,None,'Y','Repeat','J0001.wav',None,None,None,None,None,None,'* Repeat']);book.save(root/'script.xlsx')
            (root/'course.json').write_text(json.dumps(manifest))
            archive=io.BytesIO()
            with zipfile.ZipFile(archive,'w') as z:
                for p in root.iterdir():z.write(p,'wrapped/'+p.name)
            r=self.client.post('/api/dev/courses/upload/',{'file':SimpleUploadedFile('course.zip',archive.getvalue())},format='multipart')
            self.assertEqual(r.status_code,200,r.data)
            course=CourseVersion.objects.get(pk=r.data['imported'][0]['courseVersionId'])
            media=list((Path(self.temp.name)/course.pk).iterdir())
            self.assertFalse(any('--answer' in p.name for p in media))
            return course

    def finish_course(self,engine):
        course=self.upload(engine)
        setup=self.client.post(f'/api/courses/{course.pk}/setup/',{},format='json')
        self.assertEqual(setup.status_code,200,setup.data)
        if engine=='companion':
            cp=self.client.post(f'/api/courses/{course.pk}/setup/',{'checkpoint':2},format='json')
            self.assertEqual(cp.data['availableQuestionCount'],1)
        mode='L' if engine=='companion' else 'T'
        r=self.client.post('/api/sessions/',{'courseVersionId':course.pk,'mode':mode,'preview':True,'itemCount':None},format='json')
        self.assertEqual(r.status_code,201,r.data);s=r.data
        if engine=='ekspert':self.assertEqual(self.client.get(f'/api/courses/{course.pk}/reference/').status_code,403)
        for _ in range(100):
            if s['canFinish']:break
            saved=Session.objects.get(pk=s['sessionId']);q=saved.runtime['questions'][s['question']['id']]
            self.assertNotIn('solution',s['question'])
            if engine=='anvil':
                value=q['solution']['expected'];answer=value if isinstance(value,str) else json.dumps(value)
            elif engine=='ekspert':answer=json.dumps({'axes':q['solution']['axes']})
            elif engine=='companion':answer=json.dumps({'audio':base64.b64encode(wav()).decode()} if q['interaction']['voiceInput'] else {'ack':True})
            else:
                masks=q['solution']['masks']; found=q['solution'].get('found',[])
                mask=next(m for m in masks if m['id'] not in found)
                y,left,right=mask['runs'][0]
                answer=json.dumps({'x':((left+right)/2+.5)/q['interaction']['width'],'y':(y+.5)/q['interaction']['height']})
            token=str(uuid.uuid4());body={'questionId':q['id'],'submissionId':token,'answer':answer}
            response=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",body,format='json')
            self.assertEqual(response.status_code,200,response.data);s=response.data
            repeat=self.client.post(f"/api/sessions/{s['sessionId']}/answer/",body,format='json')
            self.assertEqual(repeat.data,s)
            if s['feedback'] and not s['canFinish']:
                s=self.client.post(f"/api/sessions/{s['sessionId']}/next/",{'questionId':q['id'],'submissionId':token},format='json').data
        self.assertTrue(s['canFinish'],s)
        done=self.client.post(f"/api/sessions/{s['sessionId']}/finish/",{},format='json')
        self.assertEqual(done.status_code,200,done.data)
        if engine=='companion':self.assertIsNone(done.data['totalScore'])
        else:self.assertEqual(done.data['totalScore'],1)
        history=self.client.get(f"/api/history/{s['sessionId']}/")
        self.assertEqual(history.status_code,200)
        self.assertEqual(len(history.data['review']),len(saved.runtime['questions']))
        self.assertNotIn('solution',json.dumps(history.data))
        self.assertEqual(self.client.get(f'/api/courses/{course.pk}/records/').status_code,200)

    def test_anvil_zip_all_nine_types_through_history(self):self.finish_course('anvil')
    def test_ekspert_zip_axes_and_reference_access(self):self.finish_course('ekspert')
    def test_sokole_zip_incremental_private_masks(self):self.finish_course('sokole-oko')
    def test_companion_zip_checkpoints_completion_without_grade(self):self.finish_course('companion')
