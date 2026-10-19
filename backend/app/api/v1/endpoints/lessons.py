from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.content import Course, Language, Lesson

router = APIRouter()


@router.get("/languages")
def list_languages(db: Session = Depends(get_db)):
    rows = db.scalars(select(Language).order_by(Language.sort_order)).all()
    return [
        {"id": r.id, "slug": r.slug, "name": r.name, "runtime": r.runtime} for r in rows
    ]


@router.get("/courses")
def list_courses(language: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Course).order_by(Course.sort_order)
    if language:
        stmt = stmt.join(Language).where(Language.slug == language)
    rows = db.scalars(stmt).all()
    return [
        {
            "id": r.id,
            "slug": r.slug,
            "title": r.title,
            "description": r.description,
            "level": r.level,
        }
        for r in rows
    ]


@router.get("/courses/{course_slug}/lessons")
def list_lessons(course_slug: str, db: Session = Depends(get_db)):
    course = db.scalar(select(Course).where(Course.slug == course_slug))
    if course is None:
        raise HTTPException(404, "Course not found")
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
