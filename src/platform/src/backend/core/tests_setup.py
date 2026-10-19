from django.test import TestCase
from . import tests_catalog
from .models import Session, Enrollment


class CourseSetupTests(TestCase):
    publish = tests_catalog.CatalogTests.publish
    enroll = tests_catalog.CatalogTests.enroll
    start = tests_catalog.CatalogTests.start
    complete = tests_catalog.CatalogTests.complete

    def setUp(self):
        tests_catalog.CatalogTests.setUp(self)
        self.course.payload["columns"].append(
            {"index": 4, "title": "Group", "filterOnly": True}
        )
        self.course.payload["items"] = [
            dict(
                id=str(i),
                name=f"Name {i}",
                values={"Property": [f"Value {i}"], "Group": ["A" if i < 4 else "B"]},
                media=[],
                cellMedia={},
            )
            for i in range(12)
        ]
        self.course.save()

    def setup_course(self, **selection):
        return self.client.post(
            f"/api/courses/{self.course.pk}/setup/", selection, format="json"
        )

    def test_setup_metadata_and_selection(self):
        result = self.setup_course()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["availableObjectCount"], 12)
        self.assertEqual(
            result.data["filters"], [{"field": "Group", "values": ["A", "B"]}]
        )
        self.assertNotIn("Value 0", str(result.data))
        self.assertNotIn("questions", result.data)
        selected = dict(
            kinds=["input"],
            directions=["name-to-property"],
            filters=[{"field": "Group", "values": ["A"]}],
        )
        self.assertEqual(
            self.setup_course(**selected).data["availableQuestionCount"], 4
        )
        started = self.start(preview=True, itemCount=None, **selected)
        self.assertEqual(started.status_code, 201, started.data)
        state = Session.objects.get(pk=started.data["sessionId"]).runtime
        self.assertEqual(len(state["questions"]), 4)
        self.assertEqual(state["selection"]["filters"], selected["filters"])
        self.assertTrue(
            all(
                q["kind"] == "input"
                and q["direction"] == "name-to-property"
                and int(q["objectId"]) < 4
                for q in state["questions"].values()
            )
        )

    def test_default_batch_and_invalid_selections(self):
        response = self.client.post(
            "/api/sessions/",
            {"courseVersionId": self.course.pk, "mode": "L", "preview": True},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["progress"]["total"], 10)
        for body in (
            {"directions": ["invalid"]},
            {"filters": [{"field": "Property", "values": ["Value 0"]}]},
            {"filters": [{"field": "Group", "values": ["invalid"]}]},
            {"kinds": "input"},
            {"filters": [{"field": [], "values": ["A"]}]},
            {"kinds": None},
        ):
            self.assertEqual(self.setup_course(**body).status_code, 400, body)
        self.assertEqual(self.start(preview=True, itemCount=True).status_code, 400)

    def test_unpublish_preserves_records_and_access(self):
        self.publish()
        self.client.force_authenticate(self.student)
        self.enroll()
        started = self.start().data
        self.assertEqual(self.setup_course().status_code, 200)
        self.assertEqual(
            self.client.post(
                f"/api/dev/courses/{self.course.pk}/unpublish/", {}, format="json"
            ).status_code,
            403,
        )
        self.client.force_authenticate(self.staff)
        url = f"/api/dev/courses/{self.course.pk}/unpublish/"
        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data, self.client.post(url, {}, format="json").data)
        self.assertEqual(first.data["status"], "draft")
        self.assertIsNone(first.data["publishedAt"])
        self.assertEqual(Session.objects.count(), 1)
        self.assertEqual(Enrollment.objects.count(), 1)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.setup_course().status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/sessions/{started['sessionId']}/").status_code, 404
        )
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.setup_course().status_code, 200)
        self.publish()
        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(f"/api/sessions/{started['sessionId']}/").status_code, 200
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(self.setup_course().status_code, 403)

    def test_submitted_test_marker_and_preview_isolation(self):
        self.assertFalse(self.setup_course().data["testSubmitted"])
        self.complete(self.start(preview=True).data)
        self.assertFalse(self.setup_course().data["testSubmitted"])
        self.publish()
        self.client.force_authenticate(self.student)
        self.enroll()
        self.assertFalse(self.setup_course().data["testSubmitted"])
        self.complete(self.start().data)
        self.assertTrue(self.setup_course().data["testSubmitted"])

    def test_no_questions_cannot_start_or_interrupt_existing_session(self):
        started = self.start(preview=True).data
        self.course.payload["items"] = []
        self.course.save()
        self.assertEqual(self.setup_course().data["availableQuestionCount"], 0)
        self.assertEqual(self.start(preview=True).status_code, 400)
        self.assertEqual(Session.objects.get(pk=started["sessionId"]).status, "active")

    def test_empty_selection_returns_zero_and_does_not_interrupt_session(self):
        started = self.start(preview=True).data
        for selection in (
            {"kinds": []},
            {"directions": []},
            {"filters": [{"field": "Group", "values": []}]},
        ):
            response = self.setup_course(**selection)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["availableQuestionCount"], 0)
            self.assertEqual(response.data["availableObjectCount"], 0)
            self.assertEqual(self.start(preview=True, **selection).status_code, 400)
            self.assertEqual(
                Session.objects.get(pk=started["sessionId"]).status, "active"
            )

    def test_media_variant_eligibility_matches_setup_across_session_seeds(self):
        from .selection import select_questions

        payload = {
            "columns": [],
            "items": [
                {
                    "id": str(i),
                    "name": f"Name {i}",
                    "media": [
                        {"kind": "image", "url": "/shared.png"},
                        {"kind": "image", "url": f"/unique-{i}.png"},
                    ],
                }
                for i in range(2)
            ],
        }
        _, metadata, _ = select_questions(payload, {})
        self.assertGreater(metadata["availableQuestionCount"], 0)
        directions = [entry["value"] for entry in metadata["directions"]]
        for seed in range(20):
            selected, actual, _ = select_questions(
                payload, {"directions": directions}, seed
            )
            self.assertEqual(len(selected), metadata["availableQuestionCount"])
            self.assertEqual(actual, metadata)

    def test_seed_changes_sample_order_without_changing_eligible_counts(self):
        from .selection import select_questions

        first, metadata, _ = select_questions(self.course.payload, {}, 1)
        second, other, _ = select_questions(self.course.payload, {}, 2)
        signature = lambda questions: [
            (q["objectId"], q["direction"], q["kind"]) for q in questions
        ]
        self.assertEqual(metadata, other)
        self.assertCountEqual(signature(first), signature(second))
        self.assertNotEqual(signature(first), signature(second))
        self.assertNotEqual(set(signature(first[:10])), set(signature(second[:10])))
