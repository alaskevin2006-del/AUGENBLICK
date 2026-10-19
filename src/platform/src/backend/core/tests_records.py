import uuid
from django.test import TestCase
from . import tests_catalog
from .models import Session, Enrollment


class RecordsTests(TestCase):
    publish = tests_catalog.CatalogTests.publish
    enroll = tests_catalog.CatalogTests.enroll
    start = tests_catalog.CatalogTests.start
    complete = tests_catalog.CatalogTests.complete

    def setUp(self):
        tests_catalog.CatalogTests.setUp(self)
        self.publish()
        self.client.force_authenticate(self.student)
        self.enroll()

    def withdraw(self):
        return self.client.post(
            f"/api/courses/{self.course.pk}/unenroll/", {}, format="json"
        )

    def history(self):
        return self.client.get("/api/history/")

    def fixture(
        self, correct=False, status="finished", object_id="0", preview=False, user=None
    ):
        qid = str(uuid.uuid4())
        return Session.objects.create(
            user=user or self.student,
            course_version=self.course,
            is_preview=preview,
            mode="L",
            status=status,
            random_seed=1,
            runtime={
                "questions": {qid: {"id": qid, "objectId": object_id}},
                "mastered": [qid],
                "review": [
                    {"question": {"id": qid}, "feedback": {"fullyCorrect": correct}}
                ],
            },
        )

    def test_withdraw_cancels_active_preserves_test_and_history(self):
        finished = self.complete(self.start().data).data
        active = self.start(mode="L").data
        self.assertEqual(self.withdraw().status_code, 200)
        self.assertEqual(self.withdraw().status_code, 200)
        self.assertFalse(Enrollment.objects.filter(user=self.student).exists())
        self.assertEqual(
            Session.objects.get(pk=active["sessionId"]).status, "cancelled"
        )
        self.assertEqual(len(self.history().data["results"]), 2)
        self.enroll()
        self.assertEqual(self.start().status_code, 409)
        self.assertEqual(self.start(mode="L").status_code, 201)
        self.assertEqual(
            self.client.get(f"/api/history/{finished['sessionId']}/").status_code, 200
        )

    def test_history_access_survives_unpublish_and_is_owned_closed_scoped(self):
        closed = self.fixture(status="cancelled")
        active = self.start(mode="L").data
        self.fixture(user=self.other)
        self.fixture(user=self.staff, preview=True)
        self.course.status = "draft"
        self.course.save()
        self.assertEqual(self.withdraw().status_code, 200)
        self.assertEqual(len(self.history().data["results"]), 2)
        detail = self.client.get(f"/api/history/{closed.pk}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data["review"]), 1)
        self.assertIn("createdAt", detail.data)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/history/{closed.pk}/").status_code, 404)
        self.client.force_authenticate(self.staff)
        self.assertEqual(len(self.history().data["results"]), 1)
        self.assertEqual(self.withdraw().status_code, 403)

    def test_history_pagination_and_validation(self):
        for _ in range(51):
            self.fixture()
        self.assertEqual(len(self.history().data["results"]), 50)
        self.assertEqual(self.history().data["nextPage"], 2)
        self.assertEqual(
            len(self.client.get("/api/history/?page=2").data["results"]), 1
        )
        for page in ("0", "-1", "bad", "1.5"):
            self.assertEqual(
                self.client.get("/api/history/", {"page": page}).status_code, 400
            )
        self.assertEqual(
            self.client.get("/api/history/?courseVersionId=missing").data["results"], []
        )
        active = self.start(mode="L").data
        self.assertEqual(
            self.client.get(f"/api/history/{active['sessionId']}/").status_code, 404
        )

    def test_difficulties_recovery_scope_and_selection(self):
        self.fixture()
        self.fixture(user=self.other, object_id="1")

        def difficult():
            return self.client.get("/api/difficulties/").data

        self.assertEqual(difficult()[0]["items"][0]["consecutiveCorrect"], 0)
        response = self.client.post(
            f"/api/courses/{self.course.pk}/setup/",
            {"difficultOnly": True},
            format="json",
        )
        self.assertEqual(response.data["availableObjectCount"], 1)
        started = self.start(mode="L", difficultOnly=True, itemCount=None)
        state = Session.objects.get(pk=started.data["sessionId"]).runtime
        self.assertEqual({q["objectId"] for q in state["questions"].values()}, {"0"})
        self.assertTrue(state["selection"]["difficultOnly"])
        self.fixture(correct=True, status="skipped")
        self.fixture(correct=True, status="cancelled")
        self.assertEqual(difficult()[0]["items"][0]["consecutiveCorrect"], 0)
        self.fixture(correct=True)
        self.assertEqual(difficult()[0]["items"][0]["consecutiveCorrect"], 1)
        self.fixture(correct=True)
        self.assertEqual(difficult(), [])
        response = self.client.post(
            f"/api/courses/{self.course.pk}/setup/",
            {"difficultOnly": True},
            format="json",
        )
        self.assertEqual(response.data["availableQuestionCount"], 0)
        self.assertTrue(response.data["kinds"])
        self.assertEqual(self.start(mode="L", difficultOnly=True).status_code, 400)
        self.assertEqual(self.start(mode="L", difficultOnly="true").status_code, 400)
        self.fixture(status="skipped")
        self.assertEqual(difficult()[0]["items"][0]["consecutiveCorrect"], 0)

    def test_error_then_correct_same_session_does_not_recover(self):
        session = self.fixture()
        entry = session.runtime["review"][0]
        session.runtime["review"].append(
            {"question": entry["question"], "feedback": {"fullyCorrect": True}}
        )
        session.save()
        self.assertEqual(
            self.client.get("/api/difficulties/").data[0]["items"][0][
                "consecutiveCorrect"
            ],
            0,
        )

    def test_preview_difficulties_isolated(self):
        self.fixture(user=self.staff, preview=True)
        self.assertEqual(self.client.get("/api/difficulties/").data, [])
        self.client.force_authenticate(self.staff)
        self.assertEqual(len(self.client.get("/api/difficulties/").data), 1)

    def test_archived_detail_only_exposes_answered_questions_and_cannot_mutate(self):
        started = self.start(mode="L", itemCount=2).data
        session_id = started["sessionId"]
        self.client.post(
            f"/api/sessions/{session_id}/answer/",
            {
                "questionId": started["question"]["id"],
                "submissionId": str(uuid.uuid4()),
                "answer": "wrong",
            },
            format="json",
        )
        self.withdraw()
        archived = self.client.get(f"/api/history/{session_id}/").data
        self.assertEqual(len(archived["review"]), 1)
        self.assertIsNone(archived["question"])
        self.assertNotIn("runtime", archived)
        self.assertNotIn("acceptedAnswers", str(archived))
        self.assertFalse(archived["canFinish"])
        self.assertFalse(archived["canSkip"])
        self.assertEqual(
            self.client.post(
                f"/api/sessions/{session_id}/finish/", {}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(self.client.get("/api/difficulties/").data, [])

    def test_withdrawal_does_not_reveal_another_users_draft(self):
        self.course.status = "draft"
        self.course.save()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.withdraw().status_code, 404)
