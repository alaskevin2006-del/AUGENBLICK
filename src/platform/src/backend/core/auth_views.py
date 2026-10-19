"""Token 认证端点（契约§八）：login 公开，logout/me 需认证。"""
from django.contrib.auth import authenticate
from rest_framework import status as http
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle


class LoginView(APIView):
    """POST /api/auth/login/ —— {username, password} → {token, user:{username, isDeveloper}}。"""

    authentication_classes = []  # 公开端点，坏 token 头也不拦
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        if not isinstance(request.data, dict) or not all(
            isinstance(request.data.get(key), str) and 0 < len(request.data[key]) <= 1024
            for key in ("username", "password")
        ):
            return Response({"error": "请输入用户名和密码。"}, status=http.HTTP_400_BAD_REQUEST)
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
        if user is None:
            return Response({"error": "用户名或密码错误。"}, status=http.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "user": {"username": user.username, "isDeveloper": user.is_staff},
        })


class LogoutView(APIView):
    """POST /api/auth/logout/ —— 删除当前 token → 204。"""

    def post(self, request):
        if request.auth is not None:
            request.auth.delete()
        return Response(status=http.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ —— {username, isDeveloper}。"""

    def get(self, request):
        return Response({"username": request.user.username, "isDeveloper": request.user.is_staff})
