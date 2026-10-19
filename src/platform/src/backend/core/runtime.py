"""Server-owned question bank and activity state, independent of desktop state."""

import random
import uuid
from .scoring import normalize


def build_questions(payload, seed):
    rng = random.Random(seed)
    items = payload.get("items", [])
    questions = []
    name_role = next(
        (
            c.get("role", "both")
            for c in payload.get("columns", [])
            if c.get("index") == 2
        ),
        "both",
    )

    def add(item, direction, prompt, answers, field=None, media=None, candidates=None):
        if not answers:
            return
        q = {
            "id": str(uuid.uuid4()),
            "objectId": item["id"],
            "direction": direction,
            "kind": "input",
            "prompt": prompt,
            "acceptedAnswers": answers,
        }
        if field:
            q["field"] = field
        if media:
            q["media"] = {"kind": media["kind"], "path": media["url"]}
        if candidates and any(c.get("media") for c in candidates):
            # A repeated image/audio/video cannot serve as a distinct distractor.
            correct_media = next(c for c in candidates if c["value"] in answers)
            paths = {correct_media["media"]["path"]}
            distinct_media = [correct_media]
            for candidate in candidates:
                path = candidate["media"]["path"]
                if path not in paths:
                    paths.add(path)
                    distinct_media.append(candidate)
            candidates = distinct_media
            if len(candidates) < 4:
                return
        if candidates:
            key = lambda value: tuple(
                sorted(normalize(v) for v in value.split(";") if normalize(v))
            )
            unique = {key(c["value"]): c for c in candidates}
            correct = unique.get(key(";".join(answers)))
            wrong = [c for k, c in unique.items() if k != key(";".join(answers))]
            if correct and len(wrong) >= 2:
                rng.shuffle(wrong)
                options = [correct] + wrong[:3]
                rng.shuffle(options)
                q["options"] = [dict(c, id=str(uuid.uuid4())) for c in options]
                q["kind"] = "choice"
        questions.append(q)

    def option(item, value, media=None):
        result = {"objectId": item["id"], "label": value, "value": value}
        if media:
            result["media"] = {"kind": media["kind"], "path": media["url"]}
            result["label"] = ""
        return result

    def sample_variants(assets):
        return [
            rng.choice([a for a in assets if a["kind"] == kind])
            for kind in sorted({a["kind"] for a in assets})
        ]

    names = [option(i, i["name"]) for i in items]
    for col in payload.get("columns", []):
        if col.get("index", 0) < 3 or col.get("filterOnly"):
            continue
        field = col["title"]
        role = col.get("role", "both")
        distinct = {
            tuple(
                sorted(
                    normalize(v)
                    for v in i.get("values", {}).get(field, [])
                    if normalize(v)
                )
            )
            for i in items
            if i.get("values", {}).get(field)
        }
        for item in items:
            values = item.get("values", {}).get(field, [])
            if values and len(distinct) > 1:
                if role != "question-only" and name_role != "answer-only":
                    prompt = f"{item['name']} — {col.get('forward') or field}"
                    add(item, "name-to-property", prompt, values, field)
                    add(
                        item,
                        "name-to-property",
                        prompt,
                        values,
                        field,
                        candidates=[
                            option(i, ";".join(i.get("values", {}).get(field, [])))
                            for i in items
                            if i.get("values", {}).get(field)
                        ],
                    )
                # A shared property cannot identify exactly one item.
                same = [
                    i
                    for i in items
                    if {normalize(v) for v in i.get("values", {}).get(field, [])}
                    == {normalize(v) for v in values}
                ]
                if (
                    role != "answer-only"
                    and name_role != "question-only"
                    and len(same) == 1
                ):
                    add(
                        item,
                        "property-to-name",
                        f"{'; '.join(values)} — {col.get('reverse') or field}",
                        [item["name"]],
                        field,
                        candidates=names,
                    )
            assets = item.get("cellMedia", {}).get(field, [])
            for asset in sample_variants(assets):
                ambiguous = any(
                    other["id"] != item["id"]
                    and any(
                        a["url"] == asset["url"]
                        for a in other.get("cellMedia", {}).get(field, [])
                    )
                    for other in items
                )
                if (
                    role != "answer-only"
                    and name_role != "question-only"
                    and not ambiguous
                ):
                    add(
                        item,
                        f"{asset['kind']}-to-name",
                        col.get("reverse") or field,
                        [item["name"]],
                        field,
                        asset,
                    )
                if role != "question-only" and name_role != "answer-only":
                    candidates = []
                    for other in items:
                        variants = other.get("cellMedia", {}).get(field, [])
                        variant = next(
                            (a for a in variants if a["kind"] == asset["kind"]), None
                        )
                        if variant:
                            candidates.append(option(other, other["id"], variant))
                    if len(candidates) >= 4:
                        add(
                            item,
                            f"name-to-{asset['kind']}",
                            f"{item['name']} — {col.get('forward') or field}",
                            [item["id"]],
                            field,
                            candidates=candidates,
                        )
    for item in items:
        for asset in sample_variants(item.get("media", [])):
            ambiguous = any(
                other["id"] != item["id"]
                and any(a["url"] == asset["url"] for a in other.get("media", []))
                for other in items
            )
            if name_role != "question-only" and not ambiguous:
                add(
                    item,
                    f"{asset['kind']}-to-name",
                    next(
                        (
                            c.get("reverse")
                            for c in payload.get("columns", [])
                            if c.get("index") == 2
                        ),
                        None,
                    )
                    or "Name?",
                    [item["name"]],
                    media=asset,
                    candidates=names,
                )
            candidates = []
            for other in items:
                variant = next(
                    (a for a in other.get("media", []) if a["kind"] == asset["kind"]),
                    None,
                )
                if variant:
                    candidates.append(option(other, other["id"], variant))
            if len(candidates) >= 4 and name_role != "answer-only":
                add(
                    item,
                    f"name-to-{asset['kind']}",
                    item["name"],
                    [item["id"]],
                    candidates=candidates,
                )
    # Input fallback must not duplicate an identical candidate.
    unique = {
        (
            q["objectId"],
            q["direction"],
            q.get("field"),
            q["kind"],
            str(q.get("media")),
        ): q
        for q in questions
    }
    result = list(unique.values())
    for q in result:
        attach_speech(q, payload)
        if q["kind"] == "choice" and any(o.get("media") for o in q["options"]):
            accepted = []
            labels = {}
            for opt in q["options"]:
                token = str(uuid.uuid4())
                labels[token] = next(
                    i["name"] for i in items if i["id"] == opt["objectId"]
                )
                if opt["value"] in q["acceptedAnswers"]:
                    accepted.append(token)
                opt["value"] = token
            q["acceptedAnswers"] = accepted
            q["answerLabels"] = labels
    rng.shuffle(result)
    return result


def initial_state(questions):
    return {
        "questions": {q["id"]: q for q in questions},
        "queue": [q["id"] for q in questions],
        "mastered": [],
        "failed": [],
        "streaks": {},
        "feedback": None,
        "review": [],
        "cycleRemaining": [q["id"] for q in questions],
        "cycles": 0,
    }


def public_question(q):
    if q.get('engine','znawca') != 'znawca':
        return {key: value for key,value in {**q,'objectId':q['id']}.items()
                if key in ('id','objectId','engine','kind','prompt','interaction','direction')}
    result = {
        k: v for k, v in q.items() if k not in ("acceptedAnswers", "answerLabels")
    }
    # Source identifiers can disclose the correct choice by equality.
    result["objectId"] = q["id"]
    if "options" in q:
        result["options"] = [dict(opt, objectId=opt["id"]) for opt in q["options"]]
    return result


def snapshot(session):
    state = session.runtime
    queue = state.get("queue", [])
    questions = state.get("questions", {})
    total = len(questions)
    completed = len(state.get("mastered", []))
    q = questions.get(queue[0]) if queue and session.status == "active" else None
    return {
        "sessionId": str(session.id),
        "engine": session.course_version.engine,
        "interactionFeedback": state.get('interactionFeedback'),
        "isPreview": session.is_preview,
        "courseVersionId": session.course_version_id,
        "title": session.course_version.title,
        "languageCode": session.course_version.language_code,
        "mode": session.mode,
        "status": session.status,
        "totalScore": session.total_score,
        "question": public_question(q) if q else None,
        "feedback": state.get("feedback"),
        "progress": {
            "total": total,
            "completed": completed,
            "remaining": total - completed,
        },
        "canFinish": session.status == "active" and total > 0 and completed == total,
        "canSkip": session.status == "active"
        and session.mode == "L"
        and state.get("cycles", 0) >= 3,
        "review": (
            state.get("review", []) if session.status in ("finished", "skipped") else []
        ),
    }


def attach_speech(question, payload):
    """Expose only audio for text already visible in the prompt/options."""
    speech = {a["coord"].lower(): a["url"] for a in payload.get("speech", [])}
    items = {i["id"]: i for i in payload.get("items", [])}
    item = items[question["objectId"]]
    col = next(
        (c for c in payload.get("columns", []) if c["title"] == question.get("field")),
        None,
    )
    letter = ""
    index = col["index"] if col else 0
    while index:
        index, rem = divmod(index - 1, 26)
        letter = chr(65 + rem) + letter
    row = item.get("sourceRow")
    coords = []
    direction = question["direction"]
    if not question.get("media"):
        if direction == "name-to-property":
            coords = [f"B{row}", f"{letter}1-F"]
        elif direction == "property-to-name":
            coords = [f"{letter}{row}", f"{letter}1-R"]
        elif direction.startswith("name-to-"):
            coords = [f"B{row}"]
    question["speechUrls"] = [speech[c.lower()] for c in coords if c.lower() in speech]
    for opt in question.get("options", []):
        row = items[opt["objectId"]].get("sourceRow")
        coord = f"{letter if direction=='name-to-property' else 'B'}{row}".lower()
        if not opt.get("media") and coord in speech:
            opt["speechUrl"] = speech[coord]
