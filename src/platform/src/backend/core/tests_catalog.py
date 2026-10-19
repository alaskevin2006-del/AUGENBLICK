import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import CourseVersion, Enrollment, Session, Event


class CatalogTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user("author", is_staff=True)
        self.student = get_user_model().objects.create_user("student")
        self.other = get_user_model().objects.create_user("other")
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.course = CourseVersion.objects.create(
            course_version_id="draft@1",
            title="Draft",
            language_code="en",
            item_count=3,
            content_hash="d" * 64,
            payload={
                "columns": [
                    {
                        "index": 3,
                        "title": "Property",
                        "forward": "Property?",
                        "reverse": "Name?",
                    }
                ],
                "items": [
                    {
                        "id": str(i),
                        "name": f"Name {i}",
                        "values": {"Property": [f"Value {i}"]},
                        "media": [],
                        "cellMedia": {},
                    }
                    for i in range(3)
                ],
            },
        )

    def publish(self):
        return self.client.post(
            f"/api/dev/courses/{self.course.pk}/publish/", {}, format="json"
        )

    def enroll(self):
        return self.client.post(
            f"/api/courses/{self.course.pk}/enroll/", {}, format="json"
        )

    def start(self, **extra):
        return self.client.post(
            "/api/sessions/",
            {"courseVersionId": self.course.pk, "mode": "T", "itemCount": 1, **extra},
            format="json",
        )

    def complete(self, s):
        correct = Session.objects.get(pk=s["sessionId"]).runtime["questions"][
            s["question"]["id"]
        ]["acceptedAnswers"]
        response = self.client.post(
            f"/api/sessions/{s['sessionId']}/answer/",
            {
                "questionId": s["question"]["id"],
                "submissionId": str(uuid.uuid4()),
                "answer": ";".join(correct),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return self.client.post(
            f"/api/sessions/{s['sessionId']}/finish/", {}, format="json"
        )

    def test_draft_publish_and_idempotency(self):
        self.assertEqual(
            self.client.get("/api/dev/courses/").data[0]["status"], "draft"
        )
        self.assertEqual(self.client.get("/api/courses/").data, [])
        first = self.publish()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self.publish().data, first.data)
        self.assertIsNotNone(first.data["publishedAt"])
        self.assertFalse(first.data["isEnrolled"])
        self.assertEqual(len(self.client.get("/api/courses/").data), 1)

    def test_student_permissions_and_enrollment_isolation(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get("/api/dev/courses/").status_code, 403)
        self.assertEqual(self.publish().status_code, 403)
        self.assertEqual(self.enroll().status_code, 404)
        self.assertEqual(self.start().status_code, 404)
        self.assertEqual(self.start(preview=True).status_code, 403)
        self.client.force_authenticate(self.staff)
        self.publish()
        self.assertEqual(self.enroll().status_code, 403)
        self.assertEqual(self.start().status_code, 403)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.start().status_code, 403)
        first = self.enroll()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self.enroll().data, first.data)
        self.assertEqual(Enrollment.objects.count(), 1)
        self.assertTrue(self.client.get("/api/courses/").data[0]["isEnrolled"])
        self.assertEqual(len(self.client.get("/api/my-courses/").data), 1)
        self.assertEqual(self.start().status_code, 201)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/my-courses/").data, [])
        self.assertFalse(self.client.get("/api/courses/").data[0]["isEnrolled"])
        self.assertEqual(self.start().status_code, 403)

    def test_previews_repeat_and_never_consume_formal_attempt(self):
        for mode in ("L", "T"):
            for _ in range(2):
                response = self.start(preview=True, mode=mode)
                self.assertEqual(response.status_code, 201, response.data)
                self.assertTrue(response.data["isPreview"])
                self.assertEqual(self.complete(response.data).status_code, 200)
        self.assertEqual(Enrollment.objects.count(), 0)
        self.assertEqual(self.client.get("/api/sessions/").data, [])
        self.assertEqual(len(self.client.get("/api/sessions/?preview=true").data), 4)
        for event in Event.objects.filter(type="activityFinished"):
            self.assertFalse(event.payload["attemptConsumed"])
        self.assertFalse(Session.objects.filter(is_preview=False).exists())

    def test_preview_permission_rechecked_on_every_endpoint(self):
        s = self.start(preview=True).data
        self.staff.is_staff = False
        self.staff.save(update_fields=["is_staff"])
        self.client.force_authenticate(self.staff)
        base = f"/api/sessions/{s['sessionId']}"
        self.assertEqual(self.client.get(base + "/").status_code, 403)
        for action in ("answer", "next", "finish", "skip", "events"):
            self.assertEqual(
                self.client.post(
                    base + "/" + action + "/", {}, format="json"
                ).status_code,
                403,
            )
        self.assertEqual(
            self.client.get("/api/sessions/?preview=true").status_code, 403
        )

    def test_student_formal_test_still_single_attempt(self):
        self.publish()
        self.client.force_authenticate(self.student)
        self.enroll()
        s = self.start().data
        self.assertFalse(s["isPreview"])
        self.assertEqual(self.complete(s).status_code, 200)
        self.assertEqual(self.start().status_code, 409)

    def test_unpublished_or_unenrolled_session_access_is_denied(self):
        self.publish()
        self.client.force_authenticate(self.student)
        self.enroll()
        s = self.start().data
        base = f"/api/sessions/{s['sessionId']}"
        self.course.status = "draft"
        self.course.save(update_fields=["status"])
        self.assertEqual(self.client.get(base + "/").status_code, 404)
        self.assertEqual(
            self.client.post(base + "/finish/", {}, format="json").status_code, 404
        )
        self.assertEqual(self.client.get("/api/sessions/").data, [])
        self.course.status = "published"
        self.course.save(update_fields=["status"])
        Enrollment.objects.all().delete()
        self.assertEqual(self.client.get(base + "/").status_code, 403)
        self.assertEqual(self.client.get("/api/my-courses/").data, [])


from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CatalogMigrationTests(TransactionTestCase):
    def test_existing_courses_and_activity_access_survive_migration(self):
        before = [("core", "0002_submission_session_runtime_session_user_and_more")]
        after = [
            ("core", "0003_enrollment_remove_session_uniq_active_activity_and_more")
        ]
        executor = MigrationExecutor(connection)
        executor.migrate(before)
        try:
            apps = executor.loader.project_state(before).apps
            User = apps.get_model("auth", "User")
            Course = apps.get_model("core", "CourseVersion")
            OldSession = apps.get_model("core", "Session")
            OldSubmission = apps.get_model("core", "Submission")
            OldEvent = apps.get_model("core", "Event")
            student = User.objects.create(username="legacy-student", is_staff=False)
            staff = User.objects.create(username="legacy-author", is_staff=True)
            course = Course.objects.create(
                course_version_id="legacy@1",
                title="Legacy",
                language_code="en",
                item_count=1,
                content_hash="e" * 64,
                payload={},
            )
            learner_session = OldSession.objects.create(
                course_version=course,
                user=student,
                mode="T",
                status="finished",
                random_seed=1,
            )
            preview = OldSession.objects.create(
                course_version=course,
                user=staff,
                mode="T",
                status="finished",
                random_seed=2,
            )
            OldSubmission.objects.create(
                session=preview,
                submission_id=uuid.uuid4(),
                question_id="old-question",
                answer="x",
                response={"sessionId": str(preview.pk)},
            )
            OldEvent.objects.create(
                event_id=uuid.uuid4(),
                session=preview,
                seq=1,
                ts=1,
                type="activityFinished",
                payload={"attemptConsumed": True},
            )
            executor = MigrationExecutor(connection)
            executor.migrate(after)
            apps = executor.loader.project_state(after).apps
            current = apps.get_model("core", "CourseVersion").objects.get(pk=course.pk)
            self.assertEqual(current.status, "published")
            self.assertIsNotNone(current.published_at)
            EnrollmentModel = apps.get_model("core", "Enrollment")
            self.assertEqual(
                list(
                    EnrollmentModel.objects.values_list("user_id", "course_version_id")
                ),
                [(student.pk, course.pk)],
            )
            Sessions = apps.get_model("core", "Session")
            self.assertFalse(Sessions.objects.get(pk=learner_session.pk).is_preview)
            self.assertTrue(Sessions.objects.get(pk=preview.pk).is_preview)
            self.assertTrue(
                apps.get_model("core", "Submission")
                .objects.get(session_id=preview.pk)
                .response["isPreview"]
            )
            self.assertFalse(
                apps.get_model("core", "Event")
                .objects.get(session_id=preview.pk)
                .payload["attemptConsumed"]
            )
            new = apps.get_model("core", "CourseVersion").objects.create(
                course_version_id="new@1",
                title="New",
                language_code="en",
                item_count=1,
                content_hash="f" * 64,
                payload={},
            )
            self.assertEqual(new.status, "draft")
            self.assertIsNone(new.published_at)
        finally:
            MigrationExecutor(connection).migrate(after)
