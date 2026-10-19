import json
import tempfile
from pathlib import Path
from django.test import SimpleTestCase
from .engines.ekspert import compile_source, score


class EkspertTests(SimpleTestCase):
    def compile(self, records=None):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = {"module": {"id": "shapes", "axes": [
                {"id": "shape", "name": "Shape", "type": "enum", "values": ["round", "square"]},
                {"id": "filled", "name": "Filled", "type": "boolean"}]},
                "records": records or [{"id": "a", "name": "Example", "axes": {"shape": "round", "filled": True}, "media": {"svg": "a.svg"}}]}
            (root / "data.json").write_text(json.dumps(data), encoding="utf8")
            return compile_source(root, {}, lambda p: {"kind": "image", "path": "/hashed.svg"})

    def test_single_and_multi_mean(self):
        payload = self.compile()
        self.assertEqual(len(payload["questions"]), 3)
        q = next(q for q in payload["questions"] if q["kind"] == "ekspert-multi")
        result = score(q, json.dumps({"axes": {"shape": "round", "filled": False}}))
        self.assertEqual(result["score"], .5)
        self.assertFalse(result["fullyCorrect"])
        self.assertEqual(len(result["dimensions"]), 2)
        self.assertNotIn("solution", payload["reference"]["items"][0])

    def test_invalid_axis_value_fails_import(self):
        with self.assertRaises(ValueError):
            self.compile([{"id": "bad", "axes": {"shape": "triangle", "filled": True}}])

    def test_unknown_answer_axis_and_nonfinite_rejected(self):
        q = self.compile()["questions"][0]
        for answer in ['{"axes":{"forged":1}}', '{"axes":{"shape":NaN}}', '[]']:
            with self.assertRaises(ValueError):
                score(q, answer)

    def test_blank_object_rejected(self):
        with self.assertRaises(ValueError):
            self.compile([{"id":"blank", "axes":{"shape":"round","filled":True}}])

    def test_large_enum_samples_distractors_and_keeps_correct(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            values=[f"value-{i}" for i in range(20)]
            records=[{"id":f"record-{i}","prompt":"Classify", "axes":{"type":values[-1]}, "features":{"confuse_with":[values[10]]}} for i in range(10)]
            data={"module":{"axes":[{"id":"type","type":"enum","values":values}]},"records":records}
            (root/'data.json').write_text(json.dumps(data),encoding='utf8')
            first=compile_source(root,{},lambda _: {})
            second=compile_source(root,{},lambda _: {})
            groups=[q['interaction']['axes'][0]['values'] for q in first['questions']]
            self.assertTrue(all(len(v)==6 and values[-1] in v and values[10] in v for v in groups))
            self.assertGreater(len({tuple(sorted(v)) for v in groups}),1)
            self.assertEqual(first,second)
