"""
ทดสอบ API ทั้งเส้น — ต้องมี PostgreSQL และตั้งค่า env (ดู .github/workflows/ci.yml)
ถ้าเครื่องยังไม่ได้ติดตั้ง dependency จะข้ามอัตโนมัติ
"""

import json
import time
import unittest
import uuid
from unittest import mock

try:
    import jwt
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import ai as ai_endpoint
    from app.core.config import settings
    from app.main import app
    from app.services import ai_review
except ImportError as exc:  # pragma: no cover
    raise unittest.SkipTest(f"ข้ามการทดสอบ API: {exc}")

FAKE_AI_REPLY = json.dumps(
    {
        "summary": "เกือบถูกแล้ว",
        "issues": [{"line": 1, "severity": "warning", "message": "ลองตรวจชื่อตัวแปรอีกครั้ง"}],
    },
    ensure_ascii=False,
)


def make_token(sub: str | None = None, *, secret: str | None = None, ttl: int = 3600, with_exp: bool = True) -> str:
    now = int(time.time())
    claims = {"sub": sub or uuid.uuid4().hex, "login": "tester", "picture": "https://example.com/a.png", "iat": now}
    if with_exp:
        claims["exp"] = now + ttl
    return jwt.encode(claims, secret or settings.JWT_SECRET, algorithm="HS256")


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._context = TestClient(app)
        cls.client = cls._context.__enter__()  # รัน lifespan: สร้างตาราง + seed

    @classmethod
    def tearDownClass(cls):
        cls._context.__exit__(None, None, None)

    def setUp(self):
        ai_endpoint.minute_limiter.reset()

    # ---------------------------------------------------------------- พื้นฐาน

    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

    def test_seeded_languages_and_lessons(self):
        languages = {row["slug"] for row in self.client.get("/api/v1/content/languages").json()}
        self.assertTrue({"python", "javascript"} <= languages)

        lessons = self.client.get("/api/v1/content/courses/python-basics/lessons").json()
        self.assertGreaterEqual(len(lessons), 1)
        lesson = self.client.get(f"/api/v1/content/lessons/{lessons[0]['id']}").json()
        self.assertIn("print", lesson["content_md"])

    def test_unknown_lesson_and_course_are_404(self):
        self.assertEqual(self.client.get("/api/v1/content/lessons/nope").status_code, 404)
        self.assertEqual(self.client.get("/api/v1/content/courses/nope/lessons").status_code, 404)

    # ---------------------------------------------------------------- ล็อกอิน

    def test_me_requires_a_valid_token(self):
        me = "/api/v1/auth/me"
        self.assertEqual(self.client.get(me).status_code, 401)
        self.assertEqual(self.client.get(me, headers=auth("garbage")).status_code, 401)
        self.assertEqual(self.client.get(me, headers=auth(make_token(secret="x" * 40))).status_code, 401)
        self.assertEqual(self.client.get(me, headers=auth(make_token(ttl=-10))).status_code, 401)
        self.assertEqual(self.client.get(me, headers=auth(make_token(with_exp=False))).status_code, 401)

    def test_first_request_creates_the_user_once(self):
        token = make_token()
        first = self.client.get("/api/v1/auth/me", headers=auth(token))
        second = self.client.get("/api/v1/auth/me", headers=auth(token))
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["username"], "tester")
        self.assertEqual(first.json()["id"], second.json()["id"])

    # ---------------------------------------------------------------- ความคืบหน้า

    def test_complete_lesson_and_dashboard(self):
        token = make_token()
        lessons = self.client.get("/api/v1/content/courses/python-basics/lessons").json()
        lesson_id = lessons[0]["id"]

        missing = self.client.post("/api/v1/progress/lessons/nope/complete", headers=auth(token))
        self.assertEqual(missing.status_code, 404)

        done = self.client.post(f"/api/v1/progress/lessons/{lesson_id}/complete", headers=auth(token))
        self.assertEqual(done.status_code, 200)
        dashboard = self.client.get("/api/v1/progress/dashboard", headers=auth(token)).json()
        self.assertEqual(dashboard["lessons_completed"], 1)
        self.assertEqual(dashboard["recent_lessons"][0]["id"], lesson_id)

    # ---------------------------------------------------------------- AI ตรวจโค้ด

    def review(self, token: str, **overrides):
        body = {"language": "python", "code": "print('hi')"}
        body.update(overrides)
        return self.client.post("/api/v1/ai/review", json=body, headers=auth(token))

    def test_ai_status_is_public(self):
        data = self.client.get("/api/v1/ai/status").json()
        self.assertTrue(data["enabled"])
        self.assertEqual(data["daily_limit"], settings.AI_DAILY_REQUEST_LIMIT)

    def test_review_requires_login(self):
        response = self.client.post("/api/v1/ai/review", json={"language": "python", "code": "x"})
        self.assertEqual(response.status_code, 401)

    def test_review_success_and_quota_counting(self):
        token = make_token()
        with mock.patch.object(ai_review, "call_chat_completion", return_value=(FAKE_AI_REPLY, 30)) as call:
            first = self.review(token)
            second = self.review(token)
        self.assertEqual(first.status_code, 200)
        body = first.json()
        self.assertEqual(body["summary"], "เกือบถูกแล้ว")
        self.assertEqual(body["issues"][0]["line"], 1)
        self.assertEqual(body["remaining_today"], settings.AI_DAILY_REQUEST_LIMIT - 1)
        self.assertEqual(second.json()["remaining_today"], settings.AI_DAILY_REQUEST_LIMIT - 2)

        sent = call.call_args.kwargs
        self.assertEqual(sent["model"], settings.AI_MODEL)
        self.assertIn("print('hi')", sent["messages"][1]["content"])

    def test_review_sends_last_output_as_context(self):
        with mock.patch.object(ai_review, "call_chat_completion", return_value=(FAKE_AI_REPLY, 1)) as call:
            self.review(make_token(), last_output="NameError: name 'x' is not defined")
        self.assertIn("NameError", call.call_args.kwargs["messages"][1]["content"])

    def test_review_validates_input(self):
        token = make_token()
        too_long = self.review(token, code="x" * (settings.AI_MAX_CODE_CHARS + 1))
        self.assertEqual(too_long.status_code, 413)
        self.assertEqual(too_long.json()["detail"]["code"], "code_too_long")
        self.assertEqual(self.review(token, language="py thon!").status_code, 422)
        self.assertEqual(self.review(token, code="").status_code, 422)

    def test_provider_failure_returns_502_and_refunds_quota(self):
        token = make_token()
        with mock.patch.object(ai_review, "call_chat_completion", side_effect=ai_review.AiProviderError("boom")):
            failed = self.review(token)
        self.assertEqual(failed.status_code, 502)
        self.assertEqual(failed.json()["detail"]["code"], "provider_error")

        with mock.patch.object(ai_review, "call_chat_completion", return_value=(FAKE_AI_REPLY, 1)):
            ok = self.review(token)
        self.assertEqual(ok.json()["remaining_today"], settings.AI_DAILY_REQUEST_LIMIT - 1)

    def test_provider_busy_returns_503(self):
        with mock.patch.object(ai_review, "call_chat_completion", side_effect=ai_review.AiProviderBusy("x")):
            response = self.review(make_token())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "provider_busy")

    def test_per_minute_limit(self):
        token = make_token()
        with mock.patch.object(ai_review, "call_chat_completion", return_value=(FAKE_AI_REPLY, 1)):
            for _ in range(settings.AI_PER_MINUTE_LIMIT):
                self.assertEqual(self.review(token).status_code, 200)
            blocked = self.review(token)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["detail"]["code"], "rate_limited")
        self.assertGreaterEqual(int(blocked.headers["retry-after"]), 1)

    def test_daily_limit(self):
        token = make_token()
        with mock.patch.object(settings, "AI_DAILY_REQUEST_LIMIT", 2), mock.patch.object(
            ai_review, "call_chat_completion", return_value=(FAKE_AI_REPLY, 1)
        ):
            self.assertEqual(self.review(token).status_code, 200)
            self.assertEqual(self.review(token).status_code, 200)
            blocked = self.review(token)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["detail"]["code"], "daily_quota")

    def test_ai_disabled_without_api_key(self):
        with mock.patch.object(settings, "AI_API_KEY", ""):
            self.assertFalse(self.client.get("/api/v1/ai/status").json()["enabled"])
            response = self.review(make_token())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "ai_disabled")


if __name__ == "__main__":
    unittest.main()
