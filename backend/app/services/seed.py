"""ซิงก์บทเรียน/แบบฝึกหัดจาก course_content.py เข้าฐานข้อมูลตอนเริ่มระบบ (เมื่อ AUTO_SEED=true)

ทำซ้ำกี่ครั้งก็ได้ (idempotent): มีอยู่แล้วก็อัปเดตเนื้อหา ยังไม่มีก็เพิ่ม — ไม่ลบอะไรทิ้ง
จึงใช้ส่งเนื้อหาชุดใหม่ขึ้นฐานข้อมูลที่ deploy ไปแล้วได้ โดยไม่ต้องรัน migration
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.content import Course, Language, Lesson
from app.models.exercise import Exercise
from app.services import course_content

logger = logging.getLogger(__name__)


def _apply(row: Any, values: dict[str, Any]) -> None:
    for key, value in values.items():
        setattr(row, key, value)


def sync_content_in(db: Session) -> dict[str, int]:
    """ทำงานใน session ที่ส่งมา (ผู้เรียกเป็นคน commit)"""
    stats = {"languages": 0, "courses": 0, "lessons": 0, "exercises": 0}

    languages: dict[str, Language] = {}
    for item in course_content.LANGUAGES:
        row = db.scalar(select(Language).where(Language.slug == item["slug"]))
        if row is None:
            row = Language(slug=item["slug"], name=item["name"])
            db.add(row)
        _apply(row, {"name": item["name"], "runtime": item["runtime"], "sort_order": item["sort_order"]})
        languages[item["slug"]] = row
        stats["languages"] += 1
    db.flush()

    for item in course_content.COURSES:
        course = db.scalar(select(Course).where(Course.slug == item["slug"]))
        if course is None:
            course = Course(slug=item["slug"], language_id=languages[item["language"]].id, title=item["title"])
            db.add(course)
        _apply(
            course,
            {
                "language_id": languages[item["language"]].id,
                "title": item["title"],
                "description": item["description"],
                "level": item["level"],
                "sort_order": item["sort_order"],
            },
        )
        db.flush()
        stats["courses"] += 1

        for lesson_order, lesson_item in enumerate(item["lessons"], start=1):
            lesson = db.scalar(
                select(Lesson).where(Lesson.course_id == course.id, Lesson.slug == lesson_item["slug"])
            )
            if lesson is None:
                lesson = Lesson(course_id=course.id, slug=lesson_item["slug"], title=lesson_item["title"])
                db.add(lesson)
            _apply(
                lesson,
                {
                    "title": lesson_item["title"],
                    "content_md": lesson_item["content"],
                    "starter_code": lesson_item["starter"],
                    "estimated_minutes": lesson_item["minutes"],
                    "sort_order": lesson_order,
                },
            )
            db.flush()
            stats["lessons"] += 1

            for exercise_order, ex_item in enumerate(lesson_item["exercises"], start=1):
                exercise = db.scalar(
                    select(Exercise).where(Exercise.lesson_id == lesson.id, Exercise.sort_order == exercise_order)
                )
                if exercise is None:
                    exercise = Exercise(lesson_id=lesson.id, sort_order=exercise_order, prompt=ex_item["prompt"])
                    db.add(exercise)
                _apply(
                    exercise,
                    {
                        "kind": ex_item["kind"],
                        "prompt": ex_item["prompt"],
                        "points": ex_item["points"],
                        "options": ex_item.get("options"),
                        "correct_option_id": ex_item.get("correct_option_id"),
                        "test_cases": ex_item.get("test_cases"),
                        "starter_code": ex_item.get("starter_code"),
                        "explanation": ex_item.get("explanation"),
                    },
                )
                stats["exercises"] += 1
    db.flush()
    return stats


def sync_content() -> dict[str, int]:
    db = SessionLocal()
    try:
        stats = sync_content_in(db)
        db.commit()
        logger.info("synced content: %s", stats)
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
