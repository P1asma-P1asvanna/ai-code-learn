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
    from app.api.v1.endpoints import progress as progress_endpoint
    from app.core.config import settings
    from app.main import app
    from app.services import ai_review
    from app.services.seed import sync_content
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
        progress_endpoint.submit_limiter.reset()

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

    # ---------------------------------------------------------------- บทเรียนและแบบฝึกหัด

    def lesson_page(self, course: str = "python-basics", lesson: str = "functions"):
        return self.client.get(f"/api/v1/content/courses/{course}/lessons/{lesson}")

    def submit(self, token: str, exercise_id: str, **body):
        return self.client.post(
            f"/api/v1/progress/exercises/{exercise_id}/submit", json=body, headers=auth(token)
        )

    def test_course_list_and_detail(self):
        courses = {c["slug"]: c for c in self.client.get("/api/v1/content/courses").json()}
        self.assertEqual(courses["python-basics"]["lesson_count"], 5)
        self.assertEqual(courses["python-basics"]["language"]["name"], "Python")
        self.assertEqual(courses["javascript-basics"]["lesson_count"], 5)

        detail = self.client.get("/api/v1/content/courses/python-basics").json()
        self.assertEqual([x["slug"] for x in detail["lessons"]][:2], ["hello-world", "variables"])
        self.assertEqual(detail["lessons"][1]["exercise_count"], 3)
        self.assertEqual(self.client.get("/api/v1/content/courses/nope").status_code, 404)

    def test_lesson_page_has_neighbours_and_exercises_without_answers(self):
        response = self.lesson_page()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["course"]["language"]["slug"], "python")
        self.assertEqual(data["prev"]["slug"], "loops")
        self.assertIsNone(data["next"])
        self.assertEqual([e["kind"] for e in data["exercises"]], ["mcq", "mcq", "code"])
        self.assertEqual(data["exercises"][2]["cases"][0], {"before": "", "after": "print(square(4))"})

        raw = response.text
        for secret in ('"correct_option_id"', '"expected"', '"explanation"', '"test_cases"'):
            self.assertNotIn(secret, raw)

    def test_lesson_page_404(self):
        self.assertEqual(self.lesson_page(lesson="nope").status_code, 404)
        self.assertEqual(self.lesson_page(course="nope").status_code, 404)

    def test_submit_requires_login(self):
        exercise = self.lesson_page().json()["exercises"][0]
        response = self.client.post(f"/api/v1/progress/exercises/{exercise['id']}/submit", json={"answer": "b"})
        self.assertEqual(response.status_code, 401)

    def test_mcq_scores_only_the_first_correct_answer(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][0]

        wrong = self.submit(token, exercise["id"], answer="a").json()
        self.assertFalse(wrong["passed"])
        self.assertEqual(wrong["awarded"], 0)
        self.assertIsNone(wrong["explanation"])
        self.assertIsNone(wrong["correct_option_id"])
        self.assertEqual(wrong["attempts"], 1)

        right = self.submit(token, exercise["id"], answer="b").json()
        self.assertTrue(right["passed"])
        self.assertEqual(right["awarded"], exercise["points"])
        self.assertEqual(right["correct_option_id"], "b")
        self.assertTrue(right["explanation"])
        self.assertEqual(right["attempts"], 2)

        again = self.submit(token, exercise["id"], answer="b").json()
        self.assertTrue(again["passed"])
        self.assertEqual(again["awarded"], 0)

        dashboard = self.client.get("/api/v1/progress/dashboard", headers=auth(token)).json()
        self.assertEqual(dashboard["total_score"], exercise["points"])
        self.assertEqual(dashboard["exercises_passed"], 1)

    def test_mcq_explanation_is_revealed_after_three_wrong_attempts(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][0]
        replies = [self.submit(token, exercise["id"], answer="a").json() for _ in range(3)]
        self.assertIsNone(replies[0]["explanation"])
        self.assertIsNone(replies[1]["explanation"])
        self.assertTrue(replies[2]["explanation"])
        self.assertFalse(replies[2]["passed"])

    def test_mcq_rejects_unknown_option_and_missing_answer(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][0]
        self.assertEqual(self.submit(token, exercise["id"], answer="z").status_code, 422)
        self.assertEqual(self.submit(token, exercise["id"]).status_code, 422)
        self.assertEqual(self.submit(token, "nope", answer="a").status_code, 404)

    def test_code_submission_is_graded_per_case(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][2]

        failed = self.submit(token, exercise["id"], answer="def square(x): return x", outputs=["16", "9", "1"]).json()
        self.assertFalse(failed["passed"])
        self.assertEqual(failed["cases"], [True, True, False])
        self.assertEqual(failed["failed_cases"], [{"index": 2, "expected": "0"}])
        self.assertEqual(failed["awarded"], 0)

        passed = self.submit(token, exercise["id"], answer="def square(x): return x * x", outputs=["16\n", "9", "0"]).json()
        self.assertTrue(passed["passed"])
        self.assertEqual(passed["awarded"], exercise["points"])
        self.assertEqual(passed["cases"], [True, True, True])

    def test_code_submission_validates_shape(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][2]
        self.assertEqual(self.submit(token, exercise["id"], answer="x", outputs=["16"]).status_code, 422)
        self.assertEqual(self.submit(token, exercise["id"], answer="x").status_code, 422)
        self.assertEqual(self.submit(token, exercise["id"], answer="  ", outputs=["1", "2", "3"]).status_code, 422)

    def test_finishing_every_exercise_completes_the_lesson(self):
        token = make_token()
        page = self.lesson_page("python-basics", "hello-world").json()
        mcq_one, code_ex, mcq_two = page["exercises"]
        lesson_id = page["lesson"]["id"]

        first = self.submit(token, mcq_one["id"], answer="b").json()
        second = self.submit(token, code_ex["id"], answer="print('Hello, world!')", outputs=["Hello, world!"]).json()
        self.assertEqual(first["lesson_status"], "in_progress")
        self.assertEqual(second["lesson_status"], "in_progress")
        third = self.submit(token, mcq_two["id"], answer="b").json()
        self.assertEqual(third["lesson_status"], "completed")

        progress = self.client.get(f"/api/v1/progress/lessons/{lesson_id}", headers=auth(token)).json()
        self.assertEqual(progress["status"], "completed")
        self.assertTrue(all(item["passed"] for item in progress["exercises"].values()))
        self.assertEqual(sum(item["score"] for item in progress["exercises"].values()), 40)

        course = self.client.get("/api/v1/progress/courses/python-basics", headers=auth(token)).json()
        first_lesson, second_lesson = course["lessons"][:2]
        self.assertEqual(first_lesson["status"], "completed")
        self.assertEqual(first_lesson["exercises_total"], 3)
        self.assertEqual(first_lesson["exercises_passed"], 3)
        self.assertEqual(first_lesson["score"], 40)
        self.assertEqual(second_lesson["status"], "not_started")

        dashboard = self.client.get("/api/v1/progress/dashboard", headers=auth(token)).json()
        self.assertEqual(dashboard["lessons_completed"], 1)
        self.assertEqual(dashboard["total_score"], 40)
        self.assertEqual(dashboard["exercises_passed"], 3)

    def test_progress_endpoints_need_login_and_known_ids(self):
        lesson_id = self.lesson_page().json()["lesson"]["id"]
        self.assertEqual(self.client.get(f"/api/v1/progress/lessons/{lesson_id}").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/progress/courses/python-basics").status_code, 401)

        token = make_token()
        self.assertEqual(self.client.get("/api/v1/progress/lessons/nope", headers=auth(token)).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/progress/courses/nope", headers=auth(token)).status_code, 404)
        fresh = self.client.get(f"/api/v1/progress/lessons/{lesson_id}", headers=auth(token)).json()
        self.assertEqual(fresh["status"], "not_started")

    def test_submit_is_rate_limited(self):
        token = make_token()
        exercise = self.lesson_page().json()["exercises"][0]
        with mock.patch.object(progress_endpoint.submit_limiter, "limit", 2):
            self.assertEqual(self.submit(token, exercise["id"], answer="a").status_code, 200)
            self.assertEqual(self.submit(token, exercise["id"], answer="a").status_code, 200)
            blocked = self.submit(token, exercise["id"], answer="a")
        self.assertEqual(blocked.status_code, 429)
        self.assertGreaterEqual(int(blocked.headers["retry-after"]), 1)

    def test_content_sync_is_idempotent_and_repairs_old_rows(self):
        from sqlalchemy import select

        from app.db.session import SessionLocal
        from app.models.content import Course, Lesson
        from app.models.exercise import Exercise

        # จำลองแถวแบบเก่าที่ seed ไว้ก่อนมีระบบ before/after
        with SessionLocal() as db:
            lesson = db.scalar(
                select(Lesson)
                .join(Course, Course.id == Lesson.course_id)
                .where(Course.slug == "python-basics", Lesson.slug == "hello-world")
            )
            exercise = db.scalar(
                select(Exercise).where(Exercise.lesson_id == lesson.id, Exercise.sort_order == 2)
            )
            exercise.prompt = "old prompt"
            exercise.test_cases = [{"input": "", "expected": "Hello, world!"}]
            db.commit()

        sync_content()
        stats = sync_content()
        self.assertEqual(stats["lessons"], 10)

        courses = {c["slug"]: c for c in self.client.get("/api/v1/content/courses").json()}
        self.assertEqual(courses["python-basics"]["lesson_count"], 5)
        exercises = self.lesson_page("python-basics", "hello-world").json()["exercises"]
        self.assertEqual(len(exercises), 3)
        self.assertNotEqual(exercises[1]["prompt"], "old prompt")
        self.assertEqual(exercises[1]["cases"], [{"before": "", "after": ""}])

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
