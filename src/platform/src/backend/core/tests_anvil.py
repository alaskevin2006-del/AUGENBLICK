import json
import tempfile
import zipfile
from pathlib import Path
from unittest import TestCase
from openpyxl import Workbook
from core.engines.anvil import compile_source, score


class AnvilTests(TestCase):
    def compile(self, rows, legacy=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            book = Workbook()
            sheet = book.active
            sheet.append(['difficulty', 'type', 'stimulus', 'prompt', 'option1', 'option2', 'option3'])
            for row in rows:
                sheet.append(row)
            book.save(root / 'course.xlsx')
            def asset(name):
                if name == 'missing.jpg':
                    raise ValueError('missing asset')
                return {'kind': 'audio' if name.endswith('.mp3') else 'image', 'path': '/media/hashed-'+name}
            return compile_source(root, {'source':'course.xlsx', 'legacy':legacy}, asset)

    def test_all_nine_types_and_subquestions(self):
        result = self.compile([
            [1,1,'bird.jpg','', 'Bird','Cat','Dog'],
            [1,2,'bird.jpg','', 'True','False'],
            [None,None,None,'Can fly','True'],
            [1,3,'bird.jpg','Who?', 'Bird','Cat','Dog'],
            [1,4,'A [large;small] bird.'],
            [1,5,'A [large;small] [~American;Kenyan] bird.'],
            [1,6,'*','Match', 'Bird * wings * feather','Fish * fins * scales'],
            [1,7,'Which bird?','', 'bird.jpg','cat.jpg'],
            [1,8,'*','', 'Bird * bird.jpg','Cat * cat.jpg'],
            [1,9,'call.mp3','Which?', 'bird.jpg','cat.jpg'],
        ])
        self.assertEqual(set(q['kind'] for q in result['questions']), {'anvil-'+str(i) for i in range(1,10)})
        self.assertEqual(len([q for q in result['questions'] if q['kind']=='anvil-8']),2)
        self.assertNotIn('solution',json.dumps([q['interaction'] for q in result['questions']]))
        for question in result['questions']:
            rubric=question['solution']
            answer=json.dumps(rubric['expected']) if rubric['mode'] in ('cloze','matching') else rubric['expected']
            self.assertEqual(score(question,answer)['score'],1,question['kind'])
            self.assertEqual(score(question,'wrong')['score'],0,question['kind'])

    def test_cloze_first_answer_only_and_binary_score(self):
        question=self.compile([[1,5,'[~American;Kenyan] [large;small]']])['questions'][0]
        expected=question['solution']['expected']
        self.assertEqual(score(question,json.dumps(dict(expected, **{'0':'ＡＭＥＲＩＣＡＮ'})))['score'],1)
        feedback=score(question,json.dumps(dict(expected, **{'0':'Kenyan'})))
        self.assertEqual(feedback['score'],0)
        self.assertEqual([d['score'] for d in feedback['dimensions']],[0,1])

    def test_bad_rows_degrade_good_rows_import(self):
        result=self.compile([[1,1,'missing.jpg','', 'Bird','Cat'],[1,4,'[only]'],[1,7,'Which?','', 'bird.jpg','cat.jpg']])
        self.assertEqual(len(result['questions']),1)
        self.assertEqual(len(result['warnings']),2)
        self.assertIn('C2', result['warnings'][0])

    def test_no_valid_rows_and_traversal_rejected(self):
        with self.assertRaises(ValueError):
            self.compile([[1,99,'invalid']])
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                compile_source(Path(root),{'source':'../outside.xlsx'},lambda value: {})

    def test_legacy_is_opt_in_and_matrix_distinguished(self):
        result=self.compile([['bird.jpg',None,'True','False'],[None,'Can fly','True'],['*',None,'Bird * bird.jpg','Cat * cat.jpg']],legacy=True)
        self.assertEqual([q['kind'] for q in result['questions']],['anvil-2','anvil-8','anvil-8'])

    def test_matching_rejects_duplicate_and_unknown_slots(self):
        q=self.compile([[1,6,'*','Match','Bird * wings','Fish * fins']])['questions'][0]
        expected=q['solution']['expected']
        values=list(expected.values())
        self.assertEqual(score(q,json.dumps({k:values[0] for k in expected}))['score'],0)
        self.assertEqual(score(q,json.dumps(dict(expected,unknown='x')))['score'],0)

    def test_matching_ambiguous_duplicate_parts_rejected(self):
        with self.assertRaises(ValueError):
            self.compile([[1,6,'*','Match','Bird * wings','Bat * wings']])

    def test_matrix_multiple_rows_and_media_narration(self):
        result=self.compile([[1,2,'bird.jpg','', 'True','False'],[None,None,None,'Can fly','True'],[None,None,None,'Is mammal','False']])
        self.assertEqual(len(result['questions']),2)
        self.assertEqual(result['questions'][0]['interaction']['stimulus'],result['questions'][1]['interaction']['stimulus'])

    def test_demo_zip_compiles_real_workbook_and_assets(self):
        archive=Path(__file__).resolve().parent/'fixtures/anvil-demo.zip'
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with zipfile.ZipFile(archive) as package:package.extractall(root)
            manifest=json.loads((root/'course.json').read_text(encoding='utf-8'))
            def asset(name):
                self.assertTrue((root/name).is_file())
                return {'kind':'audio' if name.endswith('.wav') else 'image','path':'/media/opaque'}
            payload=compile_source(root,manifest,asset)
            self.assertEqual(len(payload['questions']),13)
            self.assertEqual(payload['warnings'],[])

    def test_unsupported_media_not_misrepresented_as_text(self):
        with self.assertRaises(ValueError):
            self.compile([[1,1,'movie.avi','','Video','Other']])
