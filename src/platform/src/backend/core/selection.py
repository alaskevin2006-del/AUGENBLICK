"""Validated question selection shared by setup counts and activity creation."""

import random
from collections import Counter
from rest_framework.exceptions import ValidationError
from .runtime import build_questions


def select_questions(payload, data, seed=0):
    fields = [c["title"] for c in payload.get("columns", []) if c.get("filterOnly")]
    options = {
        field: sorted(
            {
                v
                for item in payload.get("items", [])
                for v in item.get("values", {}).get(field, [])
            }
        )
        for field in fields
    }
    filters = data.get("filters", [])
    if not isinstance(filters, list) or len(filters) > len(fields):
        raise ValidationError("filters must be a list of filter-only fields.")
    seen = set()
    for rule in filters:
        if (
            not isinstance(rule, dict)
            or not isinstance(rule.get("field"), str)
            or rule["field"] not in options
        ):
            raise ValidationError("Unknown filter field.")
        field = rule["field"]
        values = rule.get("values")
        if (
            field in seen
            or not isinstance(values, list)
            or any(not isinstance(v, str) or v not in options[field] for v in values)
        ):
            raise ValidationError("Filter values must be a list of available values.")
        seen.add(field)
    objects = {
        item["id"]
        for item in payload.get("items", [])
        if all(
            set(item.get("values", {}).get(rule["field"], [])) & set(rule["values"])
            for rule in filters
        )
    }
    # Build with the full corpus so filtering cannot create false uniqueness or
    # destroy valid distractors; constrain the target object before sampling.
    # Eligibility must not change with a session seed (ambiguous media variants
    # may otherwise make a displayed direction disappear at start).
    bank = build_questions(payload, 0)
    random.Random(seed).shuffle(bank)
    all_directions = {q["direction"] for q in bank}
    scoped = [q for q in bank if q["objectId"] in objects]
    kinds = data.get("kinds")
    directions = data.get("directions")
    for name, value, allowed in [
        ("kinds", kinds, {"input", "choice"}),
        ("directions", directions, all_directions),
    ]:
        if name in data and (
            not isinstance(value, list)
            or any(not isinstance(v, str) or v not in allowed for v in value)
        ):
            raise ValidationError(f"{name} must be a list of available values.")
    selected = [
        q
        for q in scoped
        if (kinds is None or q["kind"] in kinds)
        and (directions is None or q["direction"] in directions)
    ]
    metadata = {
        "availableQuestionCount": len(selected),
        "availableObjectCount": len({q["objectId"] for q in selected}),
        "kinds": [
            {"value": key, "count": count}
            for key, count in sorted(Counter(q["kind"] for q in scoped).items())
        ],
        "directions": [
            {"value": key, "count": count}
            for key, count in sorted(Counter(q["direction"] for q in scoped).items())
        ],
        "filters": [
            {"field": field, "values": values} for field, values in options.items()
        ],
    }
    selection = {"kinds": kinds, "directions": directions, "filters": filters}
    return selected, metadata, selection
