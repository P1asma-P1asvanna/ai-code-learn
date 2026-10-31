"""โค้ดตัวอย่างในเนื้อหาบทเรียนทุกบล็อกต้องรันได้จริง และทุกบทต้องมีตัวอย่างสาธิต (```ภาษา demo)

ตรวจด้วยตัวเดียวกับที่ใช้ตอนเขียนบทเรียน (tests/lesson_code_check.py) ใช้ Python/Node ในเครื่อง
JavaScript จะถูกข้ามถ้าเครื่องไม่มี node"""

import unittest

from app.services import course_content
from tests import lesson_code_check as check


class LessonContentTests(unittest.TestCase):
    def test_all_lesson_code_blocks_run_and_every_lesson_has_a_demo(self):
        problems: list[str] = []
        for course in course_content.COURSES:
            for lesson in course["lessons"]:
                key = f"{course['slug']}/{lesson['slug']}"
                problems += check.check_text(key, lesson["content"])
                if not any(is_demo for _, is_demo, _ in check.blocks(lesson["content"])):
                    problems.append(f"{key}: ไม่มีตัวอย่างสาธิตเลย")
        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main()
