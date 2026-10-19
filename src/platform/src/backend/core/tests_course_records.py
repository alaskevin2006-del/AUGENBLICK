from django.test import TestCase
from rest_framework.test import APIClient
from .models import CourseVersion, Enrollment
from . import tests_records


class CourseRecordsTests(TestCase):
    setUp = tests_records.RecordsTests.setUp
    fixture = tests_records.RecordsTests.fixture
    publish = tests_records.RecordsTests.publish
    enroll = tests_records.RecordsTests.enroll
    start = tests_records.RecordsTests.start

    def other_course(self):
        return CourseVersion.objects.create(
            course_version_id="second@1", title="Second", language_code="pl",
            content_hash="second", item_count=3, payload=self.course.payload,
            status="published",
        )

    def context(self, course=None):
        return self.client.get(f"/api/courses/{(course or self.course).pk}/records/")

    def test_course_context_keeps_counts_and_difficulties_in_current_course(self):
        self.fixture()
        test = self.fixture(status="cancelled")
        test.mode = "T"
        test.save()
        second = self.other_course()
        moved = self.fixture(object_id="1")
        moved.course_version = second
        moved.save()
        self.fixture(user=self.other, object_id="2")
        response = self.context()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["course"]["courseVersionId"], self.course.pk)
        self.assertEqual(response.data["learningHistoryCount"], 1)
        self.assertEqual(response.data["testHistoryCount"], 1)
        self.assertEqual(response.data["difficultyCount"], 1)
        self.assertTrue(response.data["canStudy"])
        self.assertNotIn("payload", response.data)
        self.assertNotIn("questions", response.data)
        self.assertEqual(self.context(second).data["difficultyCount"], 1)
        self.assertFalse(self.context(second).data["canStudy"])

    def test_empty_context_names_course_without_loading_author_payload(self):
        response = self.context()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["course"]["title"], "Draft")
        self.assertEqual(response.data["learningHistoryCount"], 0)
        self.assertEqual(response.data["testHistoryCount"], 0)
        self.assertEqual(response.data["difficultyCount"], 0)
        self.assertEqual(self.client.get("/api/record-courses/").data, [])

    def test_archived_course_is_discoverable_after_withdrawal_and_unpublish(self):
        self.fixture()
        self.course.status = "draft"
        self.course.save()
        Enrollment.objects.filter(user=self.student).delete()
        response = self.context()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["canStudy"])
        archived = self.client.get("/api/record-courses/")
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(len(archived.data), 1)
        self.assertEqual(archived.data[0]["courseVersionId"], self.course.pk)
        self.assertFalse(archived.data[0]["isEnrolled"])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.context().status_code, 404)
        self.assertEqual(self.client.get("/api/record-courses/").data, [])

    def test_developer_context_and_archive_count_only_own_preview(self):
        self.fixture()
        self.fixture(user=self.staff, preview=True)
        self.fixture(user=self.staff, preview=False, object_id="1")
        self.client.force_authenticate(self.staff)
        self.course.status = "draft"
        self.course.save()
        context = self.context()
        self.assertEqual(context.status_code, 200)
        self.assertTrue(context.data["canStudy"])
        self.assertEqual(context.data["learningHistoryCount"], 1)
        self.assertEqual(context.data["difficultyCount"], 1)
        self.assertEqual(len(self.client.get("/api/record-courses/").data), 1)
        self.client = APIClient()
        self.assertEqual(self.context().status_code, 401)
        self.assertEqual(self.client.get("/api/record-courses/").status_code, 401)

    def test_history_mode_filter_applies_before_pagination_and_within_course(self):
        for _ in range(51):
            self.fixture()
        test = self.fixture(status="cancelled")
        test.mode = "T"
        test.save()
        second = self.other_course()
        moved = self.fixture()
        moved.course_version = second
        moved.save()
        params = {"courseVersionId": self.course.pk, "mode": "L"}
        first = self.client.get("/api/history/", params)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(len(first.data["results"]), 50)
        self.assertTrue(all(r["mode"] == "L" and r["courseVersionId"] == self.course.pk for r in first.data["results"]))
        self.assertEqual(first.data["nextPage"], 2)
        second_page = self.client.get("/api/history/", {**params, "page": 2})
        self.assertEqual(len(second_page.data["results"]), 1)
        testing = self.client.get("/api/history/", {**params, "mode": "T"})
        self.assertEqual([r["sessionId"] for r in testing.data["results"]], [str(test.pk)])
        self.assertIsNone(testing.data["nextPage"])
        self.assertEqual(self.client.get("/api/history/", {**params, "mode": "all"}).status_code, 400)
