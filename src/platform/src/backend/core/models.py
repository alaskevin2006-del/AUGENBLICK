import uuid

from django.db import models
from django.conf import settings


class CourseVersion(models.Model):
    """不可变课程版本；同 content_hash 重复导入直接复用。"""

    course_version_id = models.CharField(max_length=255, primary_key=True)
    title = models.CharField(max_length=255)
    language_code = models.CharField(max_length=8)
    engine = models.CharField(max_length=32, default="znawca")
    item_count = models.IntegerField()
    payload = models.JSONField()  # 契约§二完整编译产物
    status = models.CharField(
        max_length=16,
        choices=[("draft", "Draft"), ("published", "Published")],
        default="draft",
        db_index=True,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    content_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Enrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments"
    )
    course_version = models.ForeignKey(
        CourseVersion, on_delete=models.PROTECT, related_name="enrollments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course_version"], name="uniq_course_enrollment"
            )
        ]


class Session(models.Model):
    MODE_CHOICES = [("L", "学习"), ("T", "测试")]
    STATUS_CHOICES = [
        ("active", "进行中"),
        ("finished", "已完成"),
        ("cancelled", "已取消"),
        ("skipped", "已跳过"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    course_version = models.ForeignKey(
        CourseVersion, on_delete=models.PROTECT, related_name="sessions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="learning_sessions",
    )
    is_preview = models.BooleanField(default=False)
    runtime = models.JSONField(default=dict)
    mode = models.CharField(max_length=1, choices=MODE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    random_seed = models.IntegerField()
    attempt_id = models.UUIDField(default=uuid.uuid4)
    resume_token = models.JSONField(null=True, default=None)  # 引擎私有，不透明透传
    total_score = models.FloatField(null=True, default=None)  # 后端权威值
    reported_total_score = models.FloatField(null=True, default=None)  # 引擎上报值
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course_version", "mode", "is_preview"],
                condition=models.Q(status="active"),
                name="uniq_active_activity",
            ),
            models.UniqueConstraint(
                fields=["user", "course_version"],
                condition=models.Q(status="finished", mode="T", is_preview=False),
                name="uniq_submitted_test",
            ),
        ]


class Submission(models.Model):
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="submissions"
    )
    submission_id = models.UUIDField()
    question_id = models.CharField(max_length=64)
    answer = models.TextField()
    response = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["session", "submission_id"], name="uniq_submission"
            )
        ]


class Event(models.Model):
    event_id = models.UUIDField(primary_key=True)  # 已存在 → 幂等跳过
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="events"
    )
    seq = models.IntegerField()  # 会话内从 1 严格递增
    ts = models.BigIntegerField()  # epoch ms
    type = models.CharField(max_length=32)
    payload = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "seq"], name="uniq_session_seq")
        ]
