"""Private pixel-mask compilation and incremental server-owned visual scoring."""
import base64
import io
import json
import math
from pathlib import Path
from PIL import Image
from .common import safe_file

LANGUAGES = {"en": "en", "english": "en", "pl": "pl", "polish": "pl", "ar": "ar", "arabic": "ar", "ru": "ru", "russian": "ru", "zh-s": "zh", "zh": "zh", "simplified chinese": "zh", "zh-t": "zh-TW", "traditional chinese": "zh-TW"}


def _texts(path):
    if path.stat().st_size > 65536: raise ValueError(f"{path.name}: question text too large")
    result = {}
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip(): continue
        code, sep, text = line.partition(":")
        language = LANGUAGES.get(code.strip().lower())
        if not sep or not language or not text.strip() or language in result:
            raise ValueError(f"{path.name}:{number}: invalid or duplicate translation")
        result[language] = text.strip()
    return result


def _image(path):
    try:
        with Image.open(path) as image:
            if image.width * image.height > 4_000_000 or image.width < 1 or image.height < 1:
                raise ValueError(f"{path.name}: image exceeds 4 million pixels")
            image.load()
            return image.copy()
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError(f"{path.name}: invalid image") from exc


def _overlay(mask, color):
    rgba = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    pixels = rgba.load()
    src = mask.load()
    fill = (42, 210, 110, 150) if color == "green" else (235, 65, 65, 160)
    for y in range(mask.height):
        for x in range(mask.width):
            if src[x, y] == 0: pixels[x, y] = fill
    stream = io.BytesIO()
    rgba.save(stream, format="PNG")
    return "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")


def _mask(root, name, size, index):
    path = safe_file(root, name)
    if path.suffix.lower() != ".png": raise ValueError(f"{name}: masks must be PNG")
    source = _image(path)
    if source.size != size: raise ValueError(f"{name}: mask size differs from image")
    rgba = source.convert("RGBA")
    colors = rgba.getcolors(maxcolors=3)
    if colors is None or any(c not in [(0, 0, 0, 255), (255, 255, 255, 255)] for _, c in colors):
        raise ValueError(f"{name}: mask must be opaque pure black and white")
    black = sum(n for n, c in colors if c == (0, 0, 0, 255))
    if not black: raise ValueError(f"{name}: mask has no target pixels")
    mono = source.convert("L")
    runs = []
    pixels = mono.load()
    for y in range(size[1]):
        start = None
        for x in range(size[0] + 1):
            hit = x < size[0] and pixels[x, y] == 0
            if hit and start is None: start = x
            if not hit and start is not None:
                runs.append([y, start, x - 1]); start = None
    if len(runs) > 100000: raise ValueError(f"{name}: mask is excessively fragmented")
    ratio = black / (size[0] * size[1])
    radius = min(12, max(0, round(min(size) * min(.025, .002 / math.sqrt(ratio)))))
    return {"id": f"region-{index + 1}", "runs": runs, "radius": radius,
            "green": _overlay(mono, "green"), "red": _overlay(mono, "red")}


def compile_source(root, manifest, asset):
    root = Path(root)
    language = LANGUAGES.get(str(manifest.get("languageCode", "en")).lower(), manifest.get("languageCode", "en"))
    definitions = []
    source = manifest.get("source")
    if source:
        path = safe_file(root, source)
        if path.stat().st_size > 4 * 1024 * 1024: raise ValueError("Sokole source JSON exceeds 4 MiB")
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        definitions = data.get("questions") if isinstance(data, dict) else None
        if not isinstance(definitions, list): raise ValueError("Sokole source: questions array required")
    else:
        for path in sorted(root.glob("*.txt")):
            stem = path.stem
            image_stem = stem.split("--", 1)[0]
            candidates = [p for p in root.iterdir() if p.stem == image_stem and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp", ".webp")]
            if len(candidates) != 1: raise ValueError(f"{path.name}: expected one source image")
            masks = [root / f"{stem}.png"] if "--" in stem else sorted(root.glob(f"{image_stem}--*.png"))
            definitions.append({"id": f"question-{len(definitions) + 1}", "image": candidates[0].name,
                "type": "knowledge" if "--" in stem else "observation", "masks": [p.name for p in masks], "translations": _texts(path)})
    if not 1 <= len(definitions) <= 1000: raise ValueError("Sokole: require 1–1000 questions")
    items, questions, ids, assets, compiled_masks = [], [], set(), {}, {}
    for number, entry in enumerate(definitions, 1):
        where = f"Sokole question {number}"
        if not isinstance(entry, dict): raise ValueError(f"{where}: expected object")
        identifier = entry.get("id", f"question-{number}")
        if not isinstance(identifier, str) or not identifier or identifier in ids: raise ValueError(f"{where}: duplicate or invalid id")
        ids.add(identifier)
        kind, names = entry.get("type"), entry.get("masks")
        if kind not in ("knowledge", "observation") or not isinstance(names, list) or not 1 <= len(names) <= 50 or any(not isinstance(n, str) for n in names) or len(set(names)) != len(names):
            raise ValueError(f"{where}: invalid type or masks")
        if kind == "knowledge" and len(names) != 1: raise ValueError(f"{where}: knowledge requires one mask")
        texts = entry.get("translations", {})
        prompt = entry.get("question") or (texts.get(language) if isinstance(texts, dict) else None)
        if not isinstance(prompt, str) or not prompt.strip(): raise ValueError(f"{where}: missing {language} question translation")
        image_name = entry.get("image")
        image_path = safe_file(root, image_name)
        if image_path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".bmp", ".webp"): raise ValueError(f"{where}: unsupported source image")
        image = _image(image_path)
        if image_name not in assets: assets[image_name] = asset(image_name)
        masks = []
        for index, name in enumerate(names):
            key = (name, image.size)
            if key not in compiled_masks: compiled_masks[key] = _mask(root, name, image.size, index)
            masks.append(dict(compiled_masks[key], id=f"region-{index + 1}"))
        items.append({"id": identifier, "name": prompt, "values": {}})
        questions.append({"objectId": identifier, "kind": f"sokole-{kind}", "prompt": prompt,
            "interaction": {"media": assets[image_name], "width": image.width, "height": image.height, "targetCount": len(masks)},
            "solution": {"masks": masks, "found": [], "points": []}})
    return {"items": items, "questions": questions}


def _hit(mask, x, y):
    radius = mask["radius"]
    for row, start, end in mask["runs"]:
        dy = abs(row - y)
        if dy > radius: continue
        dx = max(start - x, 0, x - end)
        if dx * dx + dy * dy <= radius * radius: return True
    return False


def score(question, answer):
    try: point = json.loads(answer)
    except (TypeError, json.JSONDecodeError) as exc: raise ValueError("A normalized x/y point is required") from exc
    if not isinstance(point, dict) or set(point) != {"x", "y"} or any(type(point[k]) not in (int, float) or not math.isfinite(point[k]) or not 0 <= point[k] <= 1 for k in ("x", "y")):
        raise ValueError("Coordinates must be finite numbers between 0 and 1")
    solution, ui = question["solution"], question["interaction"]
    # Completed interactions may only be retried through the submission idempotency layer.
    if solution.get("resolved"): raise ValueError("This visual question is already resolved")
    masks, found = solution["masks"], solution.setdefault("found", [])
    same_point = any(p["x"] == point["x"] and p["y"] == point["y"] for p in solution.setdefault("points", []))
    x, y = min(ui["width"] - 1, int(point["x"] * ui["width"])), min(ui["height"] - 1, int(point["y"] * ui["height"]))
    hits = [m for m in masks if _hit(m, x, y)]
    fresh = None if same_point else next((m for m in hits if m["id"] not in found), None)
    if len(solution.setdefault("points", [])) >= 500: raise ValueError("Too many point interactions")
    if fresh: found.append(fresh["id"])
    wrong = not hits
    solution["points"].append(dict(point, hit=bool(hits)))
    knowledge = question["kind"] == "sokole-knowledge"
    pending = not knowledge and not wrong and len(found) < len(masks)
    solution["resolved"] = not pending
    overlays = [{"id": m["id"], "path": m["green"], "color": "green"} for m in masks if m["id"] in found]
    if knowledge and wrong: overlays = [{"id": masks[0]["id"], "path": masks[0]["red"], "color": "red"}]
    fraction = len(found) / len(masks)
    return {"score": fraction, "fullyCorrect": len(found) == len(masks) and not wrong, "pending": pending,
        "correctAnswers": [], "matched": [str(len(found))], "missed": [], "extra": [],
        "dimensions": [{"id": m["id"], "label": str(i + 1), "score": int(m["id"] in found)} for i, m in enumerate(masks)],
        "overlays": overlays, "imageError": wrong and not knowledge, "foundCount": len(found), "targetCount": len(masks),
        "points": list(solution["points"]), "duplicate": bool(hits) and not fresh}
