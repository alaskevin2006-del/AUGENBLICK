import json
import tempfile
from pathlib import Path
from django.test import SimpleTestCase
from PIL import Image
from .engines.sokole import compile_source, score


class SokoleTests(SimpleTestCase):
    def compile(self, invalid=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGB", (100, 100), "white").save(root / "scene.png")
            for name, x in [("left", 10), ("right", 80)]:
                mask = Image.new("L", (100, 100), 255)
                for dx in range(10):
                    for y in range(10, 20): mask.putpixel((x + dx, y), 0)
                if invalid: mask.putpixel((0, 0), 128)
                mask.save(root / f"scene--{name}1.png")
            (root / "scene.txt").write_text("EN: Find both targets\nZH-S: 找到两个目标", encoding="utf8")
            (root / "scene--left1.txt").write_text("EN: Find the left target", encoding="utf8")
            calls = []
            result = compile_source(root, {"languageCode": "en"}, lambda p: calls.append(p) or {"kind": "image", "path": "/hashed.png"})
            self.assertEqual(calls, ["scene.png"])
            return result

    def test_incremental_duplicates_and_first_miss(self):
        q = next(q for q in self.compile()["questions"] if q["kind"] == "sokole-observation")
        first = score(q, '{"x":0.15,"y":0.15}')
        self.assertTrue(first["pending"])
        self.assertEqual(first["score"], .5)
        duplicate = score(q, '{"x":0.15,"y":0.15}')
        self.assertEqual(duplicate["score"], .5)
        miss = score(q, '{"x":0.5,"y":0.8}')
        self.assertFalse(miss["pending"])
        self.assertFalse(miss["fullyCorrect"])
        self.assertEqual(len(miss["overlays"]), 1)
        self.assertEqual(miss["score"], .5)

    def test_reverse_order_all_found(self):
        q = next(q for q in self.compile()["questions"] if q["kind"] == "sokole-observation")
        score(q, '{"x":0.85,"y":0.15}')
        self.assertTrue(score(q, '{"x":0.15,"y":0.15}')["fullyCorrect"])

    def test_knowledge_wrong_reveals_only_own_target(self):
        q = next(q for q in self.compile()["questions"] if q["kind"] == "sokole-knowledge")
        result = score(q, '{"x":0.85,"y":0.15}')
        self.assertEqual(result["score"], 0)
        self.assertEqual(len(result["overlays"]), 1)
        self.assertEqual(result["overlays"][0]["color"], "red")

    def test_mask_and_coordinate_validation(self):
        with self.assertRaises(ValueError): self.compile(invalid=True)
        q = self.compile()["questions"][0]
        for answer in ['{"x":NaN,"y":0}', '{"x":2,"y":0}', '{"x":true,"y":0}', '{"x":0.1,"y":0.1,"score":1}']:
            with self.assertRaises(ValueError): score(q, answer)

    def test_boundaries_and_bounded_tolerance(self):
        from .engines.sokole import _hit
        mask = {"runs": [[0, 0, 0]], "radius": 2}
        self.assertTrue(_hit(mask, 2, 0))
        self.assertFalse(_hit(mask, 2, 2))
        q = self.compile()["questions"][0]
        result = score(q, '{"x":1,"y":1}')
        self.assertFalse(result["fullyCorrect"])
        self.assertFalse(result["pending"])

    def test_missing_translation_and_outside_mask_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGB", (10, 10), "white").save(root / "image.png")
            definition = {"questions": [{"id": "a", "type": "knowledge", "image": "image.png", "masks": ["../outside.png"], "translations": {"en": "Find"}}]}
            (root / "questions.json").write_text(json.dumps(definition), encoding="utf8")
            for lang in ["en", "zh"]:
                with self.assertRaises(ValueError):
                    compile_source(root, {"source":"questions.json", "languageCode":lang}, lambda _: {})

    def test_overlap_finds_one_region_per_click(self):
        q = next(q for q in self.compile()["questions"] if q["kind"] == "sokole-observation")
        q["solution"]["masks"][1]["runs"] = q["solution"]["masks"][0]["runs"]
        self.assertTrue(score(q, '{"x":0.15,"y":0.15}')["pending"])
        repeated=score(q, '{"x":0.15,"y":0.15}')
        self.assertTrue(repeated["pending"])
        self.assertTrue(repeated["duplicate"])
        self.assertEqual(repeated["foundCount"],1)
        self.assertTrue(score(q, '{"x":0.16,"y":0.15}')["fullyCorrect"])

    def test_nonmatching_dimensions_and_empty_mask_rejected(self):
        from .engines.sokole import _mask
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            Image.new("L", (10,10), 255).save(root/'empty.png')
            for size in [(10,10),(20,10)]:
                with self.assertRaises(ValueError): _mask(root,'empty.png',size,0)
