import uuid

from django.db import models


class CourseVersion(models.Model):
    """不可变课程版本；同 content_hash 重复导入直接复用。"""

    course_version_id = models.CharField(max_length=255, primary_key=True)
    title = models.CharField(max_length=255)
    language_code = models.CharField(max_length=8)
    engine = models.CharField(max_length=32, default="znawca")
    item_count = models.IntegerField()
    payload = models.JSONField()  # 契约§二完整编译产物
    content_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Session(models.Model):
    MODE_CHOICES = [("L", "学习"), ("T", "测试")]
    STATUS_CHOICES = [("active", "进行中"), ("finished", "已完成"), ("cancelled", "已取消")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    course_version = models.ForeignKey(CourseVersion, on_delete=models.PROTECT, related_name="sessions")
    mode = models.CharField(max_length=1, choices=MODE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    random_seed = models.IntegerField()
    attempt_id = models.UUIDField(default=uuid.uuid4)
    resume_token = models.JSONField(null=True, default=None)  # 引擎私有，不透明透传
    total_score = models.FloatField(null=True, default=None)  # 后端权威值
    reported_total_score = models.FloatField(null=True, default=None)  # 引擎上报值
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Event(models.Model):
    event_id = models.UUIDField(primary_key=True)  # 已存在 → 幂等跳过
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="events")
    seq = models.IntegerField()  # 会话内从 1 严格递增
    ts = models.BigIntegerField()  # epoch ms
    type = models.CharField(max_length=32)
    payload = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["session", "seq"], name="uniq_session_seq")]
