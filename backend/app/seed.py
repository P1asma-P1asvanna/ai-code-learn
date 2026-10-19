"""ใส่ข้อมูลตัวอย่างเพื่อให้เปิดเว็บแล้วเห็นอะไรบ้าง: python -m app.seed"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.content import Course, Language, Lesson
from app.models.exercise import Exercise


def run() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Language).limit(1)):
            print("มีข้อมูลอยู่แล้ว ข้ามการ seed")
            return

        py = Language(slug="python", name="Python", runtime="pyodide", sort_order=1)
        js = Language(slug="javascript", name="JavaScript", runtime="js", sort_order=2)
        db.add_all([py, js])
        db.flush()

        course = Course(
            language_id=py.id,
            slug="python-basics",
            title="Python เบื้องต้น",
            description="เริ่มจากศูนย์จนเขียนโปรแกรมเล็ก ๆ ได้",
            level="beginner",
            sort_order=1,
        )
        db.add(course)
        db.flush()

        lesson = Lesson(
            course_id=course.id,
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
        db.add(lesson)
        db.flush()

        db.add_all(
            [
                Exercise(
                    lesson_id=lesson.id,
                    kind="mcq",
                    prompt="ฟังก์ชันใดใช้แสดงผลออกหน้าจอใน Python",
                    options=[
                        {"id": "a", "text": "echo()"},
                        {"id": "b", "text": "print()"},
                        {"id": "c", "text": "console.log()"},
                        {"id": "d", "text": "write()"},
                    ],
                    correct_option_id="b",
                    explanation="print() เป็นฟังก์ชันมาตรฐานของ Python "
                    "ส่วน console.log() เป็นของ JavaScript",
                    points=10,
                    sort_order=1,
                ),
                Exercise(
                    lesson_id=lesson.id,
                    kind="code",
                    prompt="เขียนโปรแกรมที่แสดงคำว่า Hello, world! ออกหน้าจอ",
                    starter_code="# เขียนโค้ดตรงนี้\n",
                    test_cases=[{"input": "", "expected": "Hello, world!"}],
                    points=20,
                    sort_order=2,
                ),
            ]
        )
        db.commit()
        print("seed เรียบร้อย")
    finally:
        db.close()


if __name__ == "__main__":
    run()
