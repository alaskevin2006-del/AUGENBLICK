"""创建切片种子账号（幂等）：dev/dev123（开发者）与 user/user123（学习者）。"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

ACCOUNTS = [
    ("dev", "dev123", True),
    ("user", "user123", False),
]


class Command(BaseCommand):
    help = "创建/重置种子账号：dev（is_staff）与 user"

    def handle(self, *args, **options):
        for username, password, is_staff in ACCOUNTS:
            user, created = User.objects.get_or_create(
                username=username, defaults={"is_staff": is_staff}
            )
            user.set_password(password)
            user.is_staff = is_staff
            user.save()
            action = "创建" if created else "已存在，重置密码/标记"
            self.stdout.write(self.style.SUCCESS(f"[{action}] {username}  is_staff={is_staff}"))
