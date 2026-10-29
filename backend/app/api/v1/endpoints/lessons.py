from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.content import Course, Language, Lesson
from app.models.exercise import Exercise
from app.services.grading import public_cases

router = APIRouter()


def _language_out(language: Language) -> dict:
    return {"slug": language.slug, "name": language.name, "runtime": language.runtime}


def _exercise_out(exercise: Exercise) -> dict:
    """ข้อมูลแบบฝึกหัดที่ส่งให้ผู้เรียน — ไม่มีเฉลยและผลที่คาดหวัง"""
    data = {
        "id": exercise.id,
        "kind": exercise.kind,
        "prompt": exercise.prompt,
        "points": exercise.points,
        "sort_order": exercise.sort_order,
    }
    if exercise.kind == "mcq":
        data["options"] = exercise.options or []
    else:
        data["starter_code"] = exercise.starter_code or ""
        data["cases"] = public_cases(exercise.test_cases)
    return data


@router.get("/languages")
def list_languages(db: Session = Depends(get_db)):
    rows = db.scalars(select(Language).order_by(Language.sort_order)).all()
    return [
        {"id": r.id, "slug": r.slug, "name": r.name, "runtime": r.runtime} for r in rows
    ]


@router.get("/courses")
def list_courses(language: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(Course, Language, func.count(Lesson.id))
        .join(Language, Language.id == Course.language_id)
        .outerjoin(Lesson, Lesson.course_id == Course.id)
        .group_by(Course.id, Language.id)
        .order_by(Language.sort_order, Course.sort_order)
    )
    if language:
        stmt = stmt.where(Language.slug == language)
    return [
        {
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "description": course.description,
            "level": course.level,
            "language": _language_out(lang),
            "lesson_count": lesson_count,
        }
        for course, lang, lesson_count in db.execute(stmt).all()
    ]


def _get_course(db: Session, course_slug: str) -> Course:
    course = db.scalar(select(Course).where(Course.slug == course_slug))
    if course is None:
        raise HTTPException(404, "Course not found")
    return course


@router.get("/courses/{course_slug}")
def get_course(course_slug: str, db: Session = Depends(get_db)):
    course = _get_course(db, course_slug)
    language = db.get(Language, course.language_id)
    lessons = db.scalars(
        select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.sort_order)
    ).all()
    exercise_counts = dict(
        db.execute(
            select(Exercise.lesson_id, func.count(Exercise.id))
            .where(Exercise.lesson_id.in_([lesson.id for lesson in lessons]))
            .group_by(Exercise.lesson_id)
        ).all()
    )
    return {
        "slug": course.slug,
        "title": course.title,
        "description": course.description,
        "level": course.level,
        "language": _language_out(language),
        "lessons": [
            {
                "id": lesson.id,
                "slug": lesson.slug,
                "title": lesson.title,
                "estimated_minutes": lesson.estimated_minutes,
                "exercise_count": exercise_counts.get(lesson.id, 0),
            }
            for lesson in lessons
        ],
    }


@router.get("/courses/{course_slug}/lessons")
def list_lessons(course_slug: str, db: Session = Depends(get_db)):
    course = _get_course(db, course_slug)
    rows = db.scalars(
        select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.sort_order)
    ).all()
    return [
        {
            "id": r.id,
            "slug": r.slug,
            "title": r.title,
            "estimated_minutes": r.estimated_minutes,
        }
        for r in rows
    ]


@router.get("/courses/{course_slug}/lessons/{lesson_slug}")
def get_lesson_by_slug(course_slug: str, lesson_slug: str, db: Session = Depends(get_db)):
    """ทุกอย่างที่หน้าอ่านบทเรียนต้องใช้ ในคำขอเดียว (backend ฟรีตื่นช้า จึงลดจำนวนรอบ)"""
    course = _get_course(db, course_slug)
    lessons = db.scalars(
        select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.sort_order)
    ).all()
    index = next((i for i, lesson in enumerate(lessons) if lesson.slug == lesson_slug), None)
    if index is None:
        raise HTTPException(404, "Lesson not found")
    lesson = lessons[index]
    language = db.get(Language, course.language_id)
    exercises = db.scalars(
        select(Exercise).where(Exercise.lesson_id == lesson.id).order_by(Exercise.sort_order)
    ).all()

    def brief(row: Lesson | None):
        return {"slug": row.slug, "title": row.title} if row else None

    return {
        "course": {"slug": course.slug, "title": course.title, "language": _language_out(language)},
        "lesson": {
            "id": lesson.id,
            "slug": lesson.slug,
            "title": lesson.title,
            "content_md": lesson.content_md,
            "starter_code": lesson.starter_code,
            "estimated_minutes": lesson.estimated_minutes,
        },
        "exercises": [_exercise_out(exercise) for exercise in exercises],
        "prev": brief(lessons[index - 1]) if index > 0 else None,
        "next": brief(lessons[index + 1]) if index + 1 < len(lessons) else None,
    }


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, db: Session = Depends(get_db)):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(404, "Lesson not found")
    return {
        "id": lesson.id,
        "title": lesson.title,
        "content_md": lesson.content_md,
        "starter_code": lesson.starter_code,
    }
