"""Authoritative answer evaluation. No synonym inference or fuzzy matching."""

import re
import unicodedata


def normalize(value):
    # Width folding is intentional; chemical subscript compatibility is opt-in.
    value = "".join(
        chr(ord(c) - 0xFEE0) if 0xFF01 <= ord(c) <= 0xFF5E else c for c in value
    )
    return (
        re.sub(r"\s+", " ", unicodedata.normalize("NFC", value).replace("\u3000", " "))
        .strip()
        .casefold()
    )


def evaluate(answer, accepted, *, subscript_compatible=False):
    def norm(s):
        if subscript_compatible:
            s = s.translate(str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789"))
        return normalize(s)

    expected = {norm(v): v for v in accepted if norm(v)}
    actual = {norm(v) for v in re.split("[;；]", answer) if norm(v)}
    matched = [v for k, v in expected.items() if k in actual]
    missed = [v for k, v in expected.items() if k not in actual]
    extra = sorted(actual - expected.keys())
    correct = bool(expected) and not missed and not extra
    # Znawca baseline is binary; matched/missed preserve useful partial feedback.
    return {
        "score": int(correct),
        "fullyCorrect": correct,
        "matched": matched,
        "missed": missed,
        "extra": extra,
        "correctAnswers": list(accepted),
    }
