import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Enrollment, CourseVersion, Session


class RuntimeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("learner")
        self.other = get_user_model().objects.create_user("other")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.course = CourseVersion.objects.create(
            course_version_id="demo@1",
            title="Demo",
            language_code="en",
            item_count=3,
            status="published",
            content_hash="a" * 64,
            payload={
                "columns": [
                    {
                        "index": 3,
                        "title": "Property",
                        "forward": "Property?",
                        "reverse": "Which item?",
                        "role": "both",
                    }
                ],
                "items": [
                    {
                        "id": str(i),
                        "name": n,
                        "values": {"Property": [p]},
                        "media": [],
                        "cellMedia": {},
                    }
                    for i, n, p in [
                        (1, "Water", "H₂O"),
                        (2, "Salt", "NaCl"),
                        (3, "Carbon", "C"),
                    ]
                ],
            },
        )

        Enrollment.objects.create(user=self.user, course_version=self.course)

    def start(self, mode="T", **kwargs):
        r = self.client.post(
            "/api/sessions/",
            {"courseVersionId": self.course.pk, "mode": mode, **kwargs},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def answer(self, s, answer="wrong", submission=None):
        return self.client.post(
            f"/api/sessions/{s['sessionId']}/answer/",
            {
                "questionId": s["question"]["id"],
                "answer": answer,
                "submissionId": submission or str(uuid.uuid4()),
            },
            format="json",
        )

    def advance(self, session):
        return self.client.post(
            f"/api/sessions/{session['sessionId']}/next/",
            {
                "questionId": session["question"]["id"],
                "submissionId": session["feedback"]["submissionId"],
            },
            format="json",
        ).data

    def test_default_scope_includes_whole_pool_over_twenty_questions(self):
        from .runtime import build_questions

        self.course.payload["items"] = [
            {
                "id": str(i),
                "name": f"Name {i}",
                "values": {"Property": [f"Value {i}"]},
                "media": [],
                "cellMedia": {},
            }
            for i in range(12)
        ]
        self.course.save(update_fields=["payload"])
        expected = len(build_questions(self.course.payload, 1))
        self.assertGreater(expected, 20)
        self.assertEqual(self.start()["progress"]["total"], expected)

    def test_non_object_write_bodies_return_validation_error(self):
        session = self.start(itemCount=1)
        urls = ["/api/sessions/"] + [
            f"/api/sessions/{session['sessionId']}/{action}/"
            for action in ("answer", "next", "finish", "skip", "events")
        ]
        for url in urls:
            for payload in ([], ["invalid"], "invalid", 12):
                with self.subTest(url=url, payload=payload):
                    response = self.client.post(url, payload, format="json")
                    self.assertEqual(response.status_code, 400, response.data)

    def test_isolation(self):
        s = self.start()
        self.assertNotIn("acceptedAnswers", str(s))
        self.assertEqual(s["review"], [])
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(f"/api/sessions/{s['sessionId']}/").status_code, 404
        )
        self.assertEqual(self.client.get("/api/sessions/").data, [])
        self.assertEqual(self.answer(s).status_code, 404)

    def test_idempotent(self):
        s = self.start()
        token = str(uuid.uuid4())
        r = self.answer(s, submission=token)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.answer(s, submission=token).data, r.data)
        self.assertEqual(
            self.answer(s, answer="different", submission=token).status_code, 409
        )
        self.assertEqual(self.answer(s).status_code, 409)

    def test_restart_no_retake(self):
        s = self.start(itemCount=1)
        self.answer(s)
        fresh = self.start(itemCount=1)
        self.assertEqual(fresh["progress"]["completed"], 0)
        self.assertEqual(Session.objects.get(pk=s["sessionId"]).status, "cancelled")
        self.assertTrue(self.answer(fresh).data["canFinish"])
        url = f"/api/sessions/{fresh['sessionId']}/finish/"
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/sessions/",
                {"courseVersionId": self.course.pk, "mode": "T"},
                format="json",
            ).status_code,
            409,
        )

    def test_forged_score_and_early_finish(self):
        s = self.start()
        base = f"/api/sessions/{s['sessionId']}"
        self.assertEqual(
            self.client.post(
                base + "/events/",
                {"events": [{"type": "itemResolved", "payload": {"score": 1}}]},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(self.client.post(base + "/finish/").status_code, 409)

    def test_learning(self):
        s = self.start("L", itemCount=1)
        base = f"/api/sessions/{s['sessionId']}"
        self.assertEqual(self.client.post(base + "/skip/").status_code, 409)
        for i in range(3):
            s = self.advance(self.answer(s).data)
        self.assertTrue(s["canSkip"])
        self.assertEqual(self.client.post(base + "/skip/").data["status"], "skipped")
        s = self.start("L", itemCount=1)
        base = f"/api/sessions/{s['sessionId']}"
        s = self.answer(s).data
        correct = s["feedback"]["correctAnswers"]
        s = self.advance(s)
        s = self.answer(s, ";".join(correct)).data
        self.assertFalse(s["canFinish"])
        self.assertTrue(s["feedback"]["needsAnother"])
        s = self.advance(s)
        resolved = self.answer(s, ";".join(correct)).data
        self.assertTrue(resolved["canFinish"])
        self.assertFalse(resolved["feedback"]["needsAnother"])

    def test_first_correct_feedback_is_mastered_with_other_questions_remaining(self):
        s = self.start("L")
        saved = Session.objects.get(pk=s["sessionId"])
        q = saved.runtime["questions"][s["question"]["id"]]
        resolved = self.answer(s, ";".join(q["acceptedAnswers"])).data
        self.assertTrue(resolved["feedback"]["fullyCorrect"])
        self.assertFalse(resolved["feedback"]["needsAnother"])
        self.assertGreater(resolved["progress"]["remaining"], 0)

    def test_stale_next_cannot_dismiss_new_feedback(self):
        s = self.start("L", itemCount=1)
        old = self.answer(s).data
        s = self.advance(old)
        newer = self.answer(s).data
        result = self.advance(old)
        self.assertEqual(result["feedback"], newer["feedback"])
        self.assertNotEqual(
            result["feedback"]["submissionId"], old["feedback"]["submissionId"]
        )

    def test_item_started_events_are_emitted_once_per_transition(self):
        session = self.start("T", itemCount=2)
        saved = Session.objects.get(pk=session["sessionId"])
        self.assertEqual(saved.events.filter(type="itemStarted").count(), 1)
        answered = self.answer(session).data
        next_question = self.advance(answered)
        self.assertEqual(saved.events.filter(type="itemStarted").count(), 2)
        self.assertEqual(self.advance(answered), next_question)
        self.assertEqual(saved.events.filter(type="itemStarted").count(), 2)
        final_answer = self.answer(next_question).data
        self.advance(final_answer)
        self.assertEqual(saved.events.filter(type="itemStarted").count(), 2)
        self.assertEqual(
            list(saved.events.order_by("seq").values_list("seq", flat=True)),
            list(range(1, 6)),
        )

    def test_learning_requeue_is_randomized_without_immediate_repeat(self):
        session = self.start("L", itemCount=4)
        saved = Session.objects.get(pk=session["sessionId"])
        saved.random_seed = 0
        saved.save(update_fields=["random_seed"])
        original = list(saved.runtime["queue"])
        observed = []
        for _ in range(12):
            observed.append(session["question"]["id"])
            session = self.advance(self.answer(session).data)
        self.assertTrue(all(a != b for a, b in zip(observed, observed[1:])))
        self.assertNotEqual(observed, original * 3)
        self.assertEqual(set(observed), set(original))

    def test_payload(self):
        self.assertEqual(
            self.client.get("/api/courses/demo@1/payload/").status_code, 403
        )

    def test_answer_rolls_back_if_event_record_fails(self):
        from unittest.mock import patch

        session = self.start(itemCount=1)
        with patch("core.views.record", side_effect=RuntimeError("storage failed")):
            with self.assertRaises(RuntimeError):
                self.answer(session)
        saved = Session.objects.get(pk=session["sessionId"])
        self.assertIsNone(saved.runtime["feedback"])
        self.assertEqual(saved.submissions.count(), 0)
        self.assertEqual(saved.events.count(), 2)

    def test_testing_cannot_skip_and_client_score_ignored(self):
        s = self.start(itemCount=1)
        base = f"/api/sessions/{s['sessionId']}"
        response = self.client.post(
            base + "/answer/",
            {
                "questionId": s["question"]["id"],
                "answer": "wrong",
                "submissionId": str(uuid.uuid4()),
                "score": 1,
            },
            format="json",
        )
        self.assertEqual(response.data["feedback"]["score"], 0)
        self.assertEqual(self.client.post(base + "/skip/").status_code, 409)
        finished = self.client.post(base + "/finish/").data
        self.assertEqual(finished["totalScore"], 0)
        self.assertEqual(len(finished["review"]), 1)
        self.assertEqual(self.client.post(base + "/finish/").data, finished)


class QuestionBankTests(TestCase):
    def setUp(self):
        self.payload = {
            "columns": [
                {"index": 2, "title": "Name", "role": "both"},
                {
                    "index": 3,
                    "title": "color",
                    "role": "both",
                    "forward": "Color?",
                    "reverse": "Which?",
                },
                {
                    "index": 4,
                    "title": "photo",
                    "role": "both",
                    "forward": "Photo?",
                    "reverse": "Name?",
                },
                {"index": 5, "title": "filter", "filterOnly": True},
            ],
            "items": [
                {
                    "id": str(i),
                    "name": f"Object {i}",
                    "sourceRow": i + 2,
                    "values": {"color": [f"Color {i}"], "filter": ["x"]},
                    "media": [{"kind": "image", "url": f"/main{i}.png"}],
                    "cellMedia": {"photo": [{"kind": "image", "url": f"/cell{i}.png"}]},
                }
                for i in range(4)
            ],
        }

    def questions(self):
        from .runtime import build_questions

        return build_questions(self.payload, 42)

    def test_media_relation_and_roles(self):
        qs = self.questions()
        for q in qs:
            self.assertNotEqual(q.get("field"), "filter")
            if q.get("field") == "photo" and q["direction"] == "image-to-name":
                self.assertEqual(q["media"]["path"], f"/cell{q['objectId']}.png")
                self.assertEqual(q["acceptedAnswers"], [f"Object {q['objectId']}"])
            if q.get("field") == "photo" and q["direction"] == "name-to-image":
                self.assertEqual(len(q["options"]), 4)
                for option in q["options"]:
                    self.assertTrue(option["media"]["path"].startswith("/cell"))
        self.payload["columns"][1]["role"] = "question-only"
        self.assertFalse(
            any(
                q.get("field") == "color" and q["direction"] == "name-to-property"
                for q in self.questions()
            )
        )
        self.payload["columns"][1]["role"] = "answer-only"
        self.assertFalse(
            any(
                q.get("field") == "color" and q["direction"] == "property-to-name"
                for q in self.questions()
            )
        )

    def test_ambiguous_reverse_and_constant_skip(self):
        for i in self.payload["items"]:
            i["values"]["color"] = ["same"]
        self.assertFalse(any(q.get("field") == "color" for q in self.questions()))
        self.payload["items"][0]["values"]["color"] = ["different"]
        reverse = [
            q
            for q in self.questions()
            if q.get("field") == "color" and q["direction"] == "property-to-name"
        ]
        self.assertEqual(len(reverse), 1)

    def test_choice_identity_does_not_reveal_answer(self):
        from .runtime import public_question

        for q in self.questions():
            public = public_question(q)
            self.assertNotIn("acceptedAnswers", public)
            for option in public.get("options", []):
                self.assertNotEqual(public["objectId"], option["objectId"])
                self.assertNotEqual(public["objectId"], option["value"])

    def test_speech_reveals_prompt_only(self):
        self.payload["speech"] = [
            {"coord": "B2", "url": "/name.mp3"},
            {"coord": "C2", "url": "/answer.mp3"},
            {"coord": "C1-F", "url": "/prompt.mp3"},
        ]
        question = next(
            q
            for q in self.questions()
            if q["objectId"] == "0"
            and q["direction"] == "name-to-property"
            and q["kind"] == "input"
        )
        self.assertEqual(question["speechUrls"], ["/name.mp3", "/prompt.mp3"])

    def test_equivalent_list_distractors_are_deduplicated(self):
        self.payload["items"][0]["values"]["color"] = ["red", "blue"]
        self.payload["items"][1]["values"]["color"] = ["BLUE", "RED"]
        choices = [
            q
            for q in self.questions()
            if q.get("field") == "color" and q["kind"] == "choice"
        ]
        for q in choices:
            if q["direction"] != "name-to-property":
                continue
            canonical = [
                tuple(sorted(v.strip().lower() for v in o["value"].split(";")))
                for o in q["options"]
            ]
            self.assertEqual(len(canonical), len(set(canonical)))
        self.assertFalse(
            any(
                q.get("field") == "color"
                and q["direction"] == "property-to-name"
                and q["objectId"] in ("0", "1")
                for q in self.questions()
            )
        )

    def test_empty_cells_do_not_defeat_constant_skip(self):
        for item in self.payload["items"]:
            item["values"]["color"] = ["same"]
        self.payload["items"][0]["values"]["color"] = []
        self.assertFalse(any(q.get("field") == "color" for q in self.questions()))

    def test_shared_media_is_not_an_ambiguous_question(self):
        self.payload["items"][1]["cellMedia"]["photo"] = self.payload["items"][0][
            "cellMedia"
        ]["photo"]
        qs = self.questions()
        self.assertFalse(
            any(
                q.get("field") == "photo"
                and q["direction"] == "image-to-name"
                and q["objectId"] in ("0", "1")
                for q in qs
            )
        )
        self.assertFalse(
            any(
                q.get("field") == "photo" and q["direction"] == "name-to-image"
                for q in qs
            )
        )

    def test_variants_are_one_relation(self):
        item = self.payload["items"][0]
        item["cellMedia"]["photo"].append({"kind": "image", "url": "/another.png"})
        questions = [
            q
            for q in self.questions()
            if q["objectId"] == "0"
            and q.get("field") == "photo"
            and q["direction"] == "image-to-name"
        ]
        self.assertEqual(len(questions), 1)


class ScoringTests(TestCase):
    def test_normalization_and_binary_scoring(self):
        from .scoring import evaluate

        self.assertEqual(evaluate(" Ａ； b ", ["a", "B"])["score"], 1)
        self.assertEqual(evaluate("a", ["a", "b"])["score"], 0)
        self.assertEqual(evaluate("a;b;extra", ["a", "b"])["score"], 0)
        self.assertEqual(evaluate("H2O", ["H₂O"])["score"], 0)
        self.assertEqual(
            evaluate("H2O", ["H₂O"], subscript_compatible=True)["score"], 1
        )
        self.assertEqual(
            evaluate("H²O", ["H2O"], subscript_compatible=True)["score"], 0
        )


class HealthTests(TestCase):
    def test_anonymous_health(self):
        self.assertEqual(self.client.get("/api/health/").json(), {"status": "ok"})

    def test_database_unavailable(self):
        from unittest.mock import patch
        from django.db import DatabaseError

        with patch(
            "core.views.connection.cursor", side_effect=DatabaseError("private detail")
        ):
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private detail", response.content.decode())
