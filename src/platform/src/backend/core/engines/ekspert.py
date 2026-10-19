"""Data-driven multi-axis classification; solutions stay on the server."""
import json
import math
import hashlib
import random
from .common import safe_file
from ..scoring import normalize


def _read(root, name):
    path = safe_file(root, name)
    if path.stat().st_size > 8 * 1024 * 1024:
        raise ValueError(f"{name}: JSON exceeds 8 MiB")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _value_ok(axis, value):
    kind = axis.get("type", "enum")
    if kind == "boolean": return type(value) is bool
    if kind == "numeric": return type(value) in (int, float) and math.isfinite(value)
    return isinstance(value, str) and value in axis.get("values", [])


def compile_source(root, manifest, asset):
    source = manifest.get("source", "data.json")
    data = _read(root, source)
    if not isinstance(data, dict): raise ValueError(f"{source}: expected object")
    module = data.get("module", data.get("meta"))
    if not isinstance(module, dict): raise ValueError(f"{source}: module metadata required")
    axes = module.get("axes")
    if not isinstance(axes, list) or not 1 <= len(axes) <= 20: raise ValueError("module.axes: require 1–20 axes")
    seen = set()
    for axis in axes:
        if not isinstance(axis, dict) or not isinstance(axis.get("id"), str) or not axis["id"] or axis["id"] in seen:
            raise ValueError("module.axes: unique nonempty ids required")
        seen.add(axis["id"])
        if not isinstance(axis.get("name", axis["id"]), str): raise ValueError(f"axis {axis['id']}: name must be text")
        kind = axis.get("type", "enum")
        if kind not in ("enum", "numeric", "boolean"): raise ValueError(f"axis {axis['id']}: unsupported type")
        if kind == "enum" and (not isinstance(axis.get("values"), list) or not 1 <= len(axis["values"]) <= 1000 or any(not isinstance(v, str) or not v or len(v)>1000 for v in axis["values"])):
            raise ValueError(f"axis {axis['id']}: enum values required")
        axis["type"] = kind
    records = data.get("records", data.get("items"))
    if not isinstance(records, list) or not 1 <= len(records) <= 5000: raise ValueError("records: require 1–5000 records")
    items, questions, atlas, ids = [], [], [], set()
    for index, record in enumerate(records):
        where = f"{source}: record {index + 1}"
        if not isinstance(record, dict) or not isinstance(record.get("id"), str) or not record["id"] or record["id"] in ids:
            raise ValueError(f"{where}: unique id required")
        ids.add(record["id"])
        values = record.get("axes")
        if not isinstance(values, dict) or set(values) - seen: raise ValueError(f"{where}: invalid axes")
        active = []
        for axis in axes:
            key = axis["id"]
            if key not in values and axis.get("optional"): continue
            if key not in values or not _value_ok(axis, values[key]): raise ValueError(f"{where}: invalid value for {key}")
            active.append(axis)
        if not active: raise ValueError(f"{where}: no answerable axes")
        media = record.get("media", {})
        if not isinstance(media, dict): raise ValueError(f"{where}: media must be object")
        image_name = media.get("svg") or media.get("img")
        image = asset(image_name) if image_name else None
        features = record.get("features", {})
        if not isinstance(features, dict): raise ValueError(f"{where}: features must be object")
        label = record.get("name", record["id"])
        if not isinstance(label, str): raise ValueError(f"{where}: name must be text")
        prompt = record.get("prompt", module.get("question", ""))
        if not isinstance(prompt, str) or len(prompt)>10000: raise ValueError(f"{where}: prompt must be text up to 10000 characters")
        if not image and not prompt.strip(): raise ValueError(f"{where}: provide an image or a nonempty prompt")
        items.append({"id": record["id"], "name": label, "values": {k: [str(v)] for k, v in values.items()}})
        atlas.append({"id": record["id"], "name": label, "axes": values, "features": features, "media": image})
        for selected in [[axis] for axis in active] + ([active] if len(active) > 1 else []):
            ui_axes = []
            for a in selected:
                seed = int.from_bytes(hashlib.sha256(f"{record['id']}:{a['id']}".encode()).digest()[:8])
                rng = random.Random(seed)
                options = list(a.get("values", [True, False] if a["type"] == "boolean" else []))
                if a["type"] == "enum" and len(options) > 6:
                    confused = record.get("confuse_with", features.get("confuse_with", []))
                    if not isinstance(confused, list): confused = []
                    preferred = list(dict.fromkeys(v for v in confused if isinstance(v,str) and v in options and v != values[a["id"]]))
                    rng.shuffle(preferred)
                    wrong = [v for v in dict.fromkeys(options) if v != values[a["id"]] and v not in preferred]
                    rng.shuffle(wrong)
                    options = [values[a["id"]]] + (preferred + wrong)[:5]
                rng.shuffle(options)
                ui_axes.append({"id": a["id"], "name": a.get("name", a["id"]), "type": a["type"], "values": options})
            questions.append({"objectId": record["id"], "kind": "ekspert-single" if len(selected) == 1 else "ekspert-multi",
                "prompt": prompt,
                "interaction": {"axes": ui_axes, "media": image},
                "solution": {"axes": {a["id"]: values[a["id"]] for a in selected}, "labels": {a["id"]: a.get("name", a["id"]) for a in selected}}})
    return {"items": items, "questions": questions, "reference": {"axes": axes, "items": atlas},
            "columns": [{"title": a["id"], "filterOnly": True} for a in axes]}


def score(question, answer):
    try: data = json.loads(answer, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite answer")))
    except (TypeError, json.JSONDecodeError) as exc: raise ValueError("Expected axis answers") from exc
    expected = question["solution"]["axes"]
    if not isinstance(data, dict) or set(data) != {"axes"} or not isinstance(data["axes"], dict) or set(data["axes"]) - set(expected):
        raise ValueError("Expected known axis answers")
    dims, correct, actual = [], [], []
    for key, value in expected.items():
        submitted = data["axes"].get(key)
        if submitted is not None and (type(submitted) not in (str, int, float, bool) or isinstance(submitted, str) and len(submitted) > 1000):
            raise ValueError("Invalid axis answer")
        hit = type(submitted) is type(value) and submitted == value
        if isinstance(value, str) and isinstance(submitted, str): hit = normalize(submitted) == normalize(value)
        if type(value) in (int, float) and type(submitted) in (int, float): hit = math.isfinite(submitted) and value == submitted
        label = question["solution"]["labels"][key]
        dims.append({"id": key, "label": label, "score": int(hit)})
        correct.append(f"{label}: {value}")
        actual.append(f"{label}: {submitted if submitted is not None else '—'}")
    fraction = sum(d["score"] for d in dims) / len(dims)
    return {"score": fraction, "fullyCorrect": fraction == 1, "correctAnswers": correct,
            "matched": [correct[i] for i, d in enumerate(dims) if d["score"]], "missed": [correct[i] for i, d in enumerate(dims) if not d["score"]],
            "extra": [], "dimensions": dims, "submittedLabels": actual}
