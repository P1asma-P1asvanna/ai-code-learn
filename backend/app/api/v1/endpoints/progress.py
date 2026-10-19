from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.content import Lesson
from app.models.exercise import Submission
from app.models.progress import LessonProgress
from app.models.user import User

router = APIRouter()


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
        )
    )
    if row is None:
        row = LessonProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(row)
    row.status = "completed"
    row.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": row.status, "completed_at": row.completed_at}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    total_lessons = db.scalar(select(func.count(Lesson.id))) or 0
    completed = (
        db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.user_id == user.id,
                LessonProgress.status == "completed",
            )
        )
        or 0
    )
    total_score = (
        db.scalar(
            select(func.coalesce(func.sum(Submission.score), 0)).where(
                Submission.user_id == user.id
            )
        )
        or 0
    )
    recent = db.scalars(
        select(Lesson)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .where(LessonProgress.user_id == user.id)
        .order_by(LessonProgress.updated_at.desc())
        .limit(5)
    ).all()

    return {
        "lessons_completed": completed,
        "lessons_total": total_lessons,
        "total_score": total_score,
        "recent_lessons": [{"id": r.id, "title": r.title} for r in recent],
    }
