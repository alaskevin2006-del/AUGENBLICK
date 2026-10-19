"""Real PostgreSQL race regressions; SQLite cannot validate row locking."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from .models import CourseVersion, Event, Session, Submission


@skipUnless(
    connection.vendor == "postgresql",
    "Requires PostgreSQL row locks; SQLite is explicitly unsupported for this test.",
)
class PostgreSQLRuntimeConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("concurrent-learner")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.course = CourseVersion.objects.create(
            course_version_id="concurrency@1",
            title="Concurrency",
            language_code="en",
            item_count=3,
            content_hash="c" * 64,
            payload={
                "columns": [
                    {
                        "index": 3,
                        "title": "property",
                        "role": "both",
                        "forward": "Property?",
                        "reverse": "Name?",
                    }
                ],
                "items": [
                    {
                        "id": str(i),
                        "name": f"Name {i}",
                        "values": {"property": [f"Value {i}"]},
                        "media": [],
                        "cellMedia": {},
                    }
                    for i in range(3)
                ],
            },
        )
        self.start_payload = {
            "courseVersionId": self.course.pk,
            "mode": "T",
            "itemCount": 1,
        }

    def race(self, *requests):
        """Each request uses its own connection and starts behind a shared barrier.

        Database timeouts turn deadlocks or stalled workers into test failures.
        APIClient raises uncaught server exceptions; futures propagate every error.
        """
        barrier = Barrier(len(requests))
        user_id = self.user.pk

        def worker(request):
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET statement_timeout = '15s'")
                    cursor.execute("SET lock_timeout = '10s'")
                client = APIClient()
                client.force_authenticate(get_user_model().objects.get(pk=user_id))
                barrier.wait(timeout=10)
                url, payload = request
                response = client.post(url, payload, format="json")
                return response.status_code, response.data
            finally:
                connections.close_all()
                close_old_connections()

        with ThreadPoolExecutor(max_workers=len(requests)) as executor:
            futures = [executor.submit(worker, request) for request in requests]
            return [future.result(timeout=30) for future in futures]

    def start(self):
        response = self.client.post("/api/sessions/", self.start_payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def answer(self, session):
        response = self.client.post(
            f"/api/sessions/{session['sessionId']}/answer/",
            {
                "questionId": session["question"]["id"],
                "submissionId": str(uuid.uuid4()),
                "answer": "wrong",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_same_submission_commits_one_answer_and_event(self):
        session = self.start()
        payload = {
            "questionId": session["question"]["id"],
            "submissionId": str(uuid.uuid4()),
            "answer": "wrong",
        }
        request = (f"/api/sessions/{session['sessionId']}/answer/", payload)
        results = self.race(request, request)
        self.assertEqual([status for status, _ in results], [200, 200], results)
        self.assertEqual(results[0][1], results[1][1])
        self.assertEqual(
            Submission.objects.filter(session_id=session["sessionId"]).count(), 1
        )
        self.assertEqual(
            Event.objects.filter(
                session_id=session["sessionId"], type="itemResolved"
            ).count(),
            1,
        )
        saved = Session.objects.get(pk=session["sessionId"])
        self.assertEqual(len(saved.runtime["review"]), 1)
        self.assertEqual(len(saved.runtime["mastered"]), 1)

    def test_concurrent_finish_consumes_one_attempt(self):
        session = self.answer(self.start())
        request = (f"/api/sessions/{session['sessionId']}/finish/", {})
        results = self.race(request, request)
        self.assertEqual([status for status, _ in results], [200, 200], results)
        self.assertEqual(results[0][1], results[1][1])
        self.assertEqual(
            Session.objects.filter(user=self.user, mode="T", status="finished").count(),
            1,
        )
        events = Event.objects.filter(
            session_id=session["sessionId"], type="activityFinished"
        )
        self.assertEqual(events.count(), 1)
        self.assertTrue(events.get().payload["attemptConsumed"])
        self.assertEqual(results[0][1]["totalScore"], 0)

    def test_concurrent_start_serializes_restart_without_integrity_errors(self):
        request = ("/api/sessions/", self.start_payload)
        results = self.race(request, request)
        self.assertEqual([status for status, _ in results], [201, 201], results)
        sessions = Session.objects.filter(
            user=self.user, course_version=self.course, mode="T"
        )
        self.assertEqual(sessions.count(), 2)
        self.assertEqual(sessions.filter(status="active").count(), 1)
        self.assertEqual(sessions.filter(status="cancelled").count(), 1)
        self.assertEqual(Event.objects.filter(type="activityInterrupted").count(), 1)

    def test_start_racing_finish_cannot_bypass_submitted_test_guard(self):
        old = self.answer(self.start())
        start, finish = self.race(
            ("/api/sessions/", self.start_payload),
            (f"/api/sessions/{old['sessionId']}/finish/", {}),
        )
        self.assertIn((start[0], finish[0]), ((409, 200), (201, 409)), (start, finish))
        if start[0] == 201:
            # Restart won: old attempt was never submitted. Submit the new one.
            self.assertEqual(
                Session.objects.get(pk=old["sessionId"]).status, "cancelled"
            )
            self.answer(start[1])
            response = self.client.post(
                f"/api/sessions/{start[1]['sessionId']}/finish/", {}, format="json"
            )
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            Session.objects.filter(user=self.user, mode="T", status="finished").count(),
            1,
        )
        self.assertEqual(
            Session.objects.filter(user=self.user, mode="T", status="active").count(), 0
        )
        self.assertEqual(Event.objects.filter(type="activityFinished").count(), 1)
        self.assertEqual(
            self.client.post(
                "/api/sessions/", self.start_payload, format="json"
            ).status_code,
            409,
        )
