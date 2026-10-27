"""บทเรียนตัวอย่าง — ใส่ให้อัตโนมัติตอนเริ่มระบบเมื่อ AUTO_SEED=true และฐานข้อมูลยังว่าง"""

import logging

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.content import Course, Language, Lesson
from app.models.exercise import Exercise

logger = logging.getLogger(__name__)


def seed_if_empty() -> bool:
    db = SessionLocal()
    try:
        if db.scalar(select(Language.id).limit(1)):
            return False

        python = Language(slug="python", name="Python", runtime="pyodide", sort_order=1)
        javascript = Language(slug="javascript", name="JavaScript", runtime="js", sort_order=2)
        db.add_all([python, javascript])
        db.flush()

        py_course = Course(
            language_id=python.id,
            slug="python-basics",
            title="Python เบื้องต้น",
            description="เริ่มจากศูนย์จนเขียนโปรแกรมเล็ก ๆ ได้",
            level="beginner",
            sort_order=1,
        )
        js_course = Course(
            language_id=javascript.id,
            slug="javascript-basics",
            title="JavaScript เบื้องต้น",
            description="พื้นฐานภาษาที่ทำให้เว็บมีชีวิต",
            level="beginner",
            sort_order=2,
        )
        db.add_all([py_course, js_course])
        db.flush()

        py_lesson = Lesson(
            course_id=py_course.id,
            slug="hello-world",
            title="โปรแกรมแรกของคุณ",
            content_md=(
                "# โปรแกรมแรกของคุณ\n\n"
                "ใน Python การแสดงผลออกหน้าจอใช้ฟังก์ชัน `print()`\n\n"
                "```python\nprint('Hello, world!')\n```\n"
            ),
            starter_code="print('Hello, world!')\n",
            estimated_minutes=5,
            sort_order=1,
        )
        js_lesson = Lesson(
            course_id=js_course.id,
            slug="hello-world",
            title="โปรแกรมแรกของคุณ",
            content_md=(
                "# โปรแกรมแรกของคุณ\n\n"
                "ใน JavaScript การแสดงผลออกหน้าจอ (console) ใช้ `console.log()`\n\n"
                "```javascript\nconsole.log('Hello, world!');\n```\n"
            ),
            starter_code="console.log('Hello, world!');\n",
            estimated_minutes=5,
            sort_order=1,
        )
        db.add_all([py_lesson, js_lesson])
        db.flush()

        db.add_all(
            [
                Exercise(
                    lesson_id=py_lesson.id,
                    kind="mcq",
                    prompt="ฟังก์ชันใดใช้แสดงผลออกหน้าจอใน Python",
                    options=[
                        {"id": "a", "text": "echo()"},
                        {"id": "b", "text": "print()"},
                        {"id": "c", "text": "console.log()"},
                        {"id": "d", "text": "write()"},
                    ],
                    correct_option_id="b",
                    explanation="print() เป็นฟังก์ชันมาตรฐานของ Python ส่วน console.log() เป็นของ JavaScript",
                    points=10,
                    sort_order=1,
                ),
                Exercise(
                    lesson_id=py_lesson.id,
                    kind="code",
                    prompt="เขียนโปรแกรมที่แสดงคำว่า Hello, world! ออกหน้าจอ",
                    starter_code="# เขียนโค้ดตรงนี้\n",
                    test_cases=[{"input": "", "expected": "Hello, world!"}],
                    points=20,
                    sort_order=2,
                ),
                Exercise(
                    lesson_id=js_lesson.id,
                    kind="mcq",
                    prompt="คำสั่งใดใช้แสดงข้อความออก console ใน JavaScript",
                    options=[
                        {"id": "a", "text": "print()"},
                        {"id": "b", "text": "console.log()"},
                        {"id": "c", "text": "echo()"},
                        {"id": "d", "text": "System.out.println()"},
                    ],
                    correct_option_id="b",
                    explanation="console.log() แสดงค่าออก console ส่วน System.out.println() เป็นของ Java",
                    points=10,
                    sort_order=1,
                ),
            ]
        )
        db.commit()
        logger.info("seeded sample content")
        return True
    finally:
        db.close()
