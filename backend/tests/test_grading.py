"""ทดสอบการตรวจแบบฝึกหัดและความถูกต้องของข้อมูลบทเรียน — ใช้เฉพาะ standard library (ไม่ต้องมีฐานข้อมูล/FastAPI)"""

import unittest

from app.services import course_content, grading


class NormalizeTests(unittest.TestCase):
    def test_ignores_trailing_spaces_and_blank_lines(self):
        self.assertEqual(grading.normalize_output("a  \nb\t\n\n\n"), "a\nb")

    def test_handles_windows_line_endings(self):
        self.assertEqual(grading.normalize_output("a\r\nb\r\n"), "a\nb")

    def test_keeps_inner_blank_lines_and_leading_spaces(self):
        self.assertEqual(grading.normalize_output("  a\n\nb"), "  a\n\nb")

    def test_empty_and_none(self):
        self.assertEqual(grading.normalize_output(None), "")
        self.assertEqual(grading.normalize_output(""), "")


class GradeTests(unittest.TestCase):
    def test_mcq(self):
        self.assertTrue(grading.grade_mcq("b", "b"))
        self.assertFalse(grading.grade_mcq("b", "a"))
        self.assertFalse(grading.grade_mcq("b", None))
        self.assertFalse(grading.grade_mcq(None, None))

    def test_code_cases_are_graded_independently(self):
        cases = [{"expected": "16"}, {"expected": "9"}]
        results = grading.grade_code(cases, ["16\n", "10"])
        self.assertEqual([r["passed"] for r in results], [True, False])
        self.assertEqual(results[1]["expected"], "9")

    def test_code_requires_exact_text(self):
        self.assertFalse(grading.grade_code([{"expected": "Hello, world!"}], ["hello, world!"])[0]["passed"])
        self.assertTrue(grading.grade_code([{"expected": "ผ่าน"}], ["ผ่าน  "])[0]["passed"])

    def test_missing_output_fails(self):
        self.assertFalse(grading.grade_code([{"expected": "1"}], [""])[0]["passed"])

    def test_length_mismatch_is_rejected_by_caller_not_silently_graded(self):
        with self.assertRaises(ValueError):
            grading.grade_code([{"expected": "1"}], [])

    def test_public_cases_hide_expected_output(self):
        public = grading.public_cases([{"before": "n = 5", "after": "", "expected": "15"}])
        self.assertEqual(public, [{"before": "n = 5", "after": ""}])
        self.assertNotIn("expected", public[0])

    def test_public_cases_accepts_legacy_rows(self):
        # แถวเก่าที่ seed ไว้ก่อนมีระบบ before/after (ยังไม่ถูกซิงก์ทับ)
        self.assertEqual(
            grading.public_cases([{"input": "", "expected": "Hello, world!"}]),
            [{"before": "", "after": ""}],
        )
        self.assertEqual(grading.public_cases(None), [])


class CourseContentTests(unittest.TestCase):
    def lessons(self):
        for course in course_content.COURSES:
            for lesson in course["lessons"]:
                yield course, lesson

    def test_every_course_points_to_a_known_language(self):
        languages = {lang["slug"] for lang in course_content.LANGUAGES}
        slugs = set()
        for course in course_content.COURSES:
            self.assertIn(course["language"], languages)
            self.assertNotIn(course["slug"], slugs)
            slugs.add(course["slug"])

    def test_lesson_slugs_are_unique_within_a_course(self):
        for course in course_content.COURSES:
            slugs = [lesson["slug"] for lesson in course["lessons"]]
            self.assertEqual(len(slugs), len(set(slugs)), course["slug"])

    def test_lessons_have_content_and_exercises(self):
        for course, lesson in self.lessons():
            where = f'{course["slug"]}/{lesson["slug"]}'
            self.assertTrue(lesson["content"].startswith("# "), where)
            self.assertEqual(lesson["content"].count("```") % 2, 0, where)
            self.assertGreaterEqual(len(lesson["exercises"]), 2, where)

    def test_mcq_has_valid_correct_option(self):
        for course, lesson in self.lessons():
            for exercise in lesson["exercises"]:
                if exercise["kind"] != "mcq":
                    continue
                ids = [option["id"] for option in exercise["options"]]
                self.assertEqual(len(ids), len(set(ids)))
                self.assertIn(exercise["correct_option_id"], ids)
                self.assertTrue(exercise["explanation"])

    def test_code_exercises_have_cases_with_expected_output(self):
        for course, lesson in self.lessons():
            for exercise in lesson["exercises"]:
                if exercise["kind"] != "code":
                    continue
                cases = exercise["test_cases"]
                self.assertTrue(1 <= len(cases) <= 10)
                for case in cases:
                    self.assertTrue(case["expected"].strip())
                self.assertIn("starter_code", exercise)

    def test_points_are_positive(self):
        for _, lesson in self.lessons():
            for exercise in lesson["exercises"]:
                self.assertGreater(exercise["points"], 0)


if __name__ == "__main__":
    unittest.main()
