from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.content import Course, Lesson
from app.models.exercise import Exercise, Submission
from app.models.progress import LessonProgress
from app.models.user import User
from app.schemas.exercise import SubmitIn
from app.services import grading
from app.services.rate_limit import SlidingWindowLimiter

router = APIRouter()

# กันกดส่งคำตอบรัว ๆ (ในหน่วยความจำ process เดียว พอสำหรับ free tier)
submit_limiter = SlidingWindowLimiter(limit=30, window_seconds=60.0)

# ตอบผิดครบกี่ครั้งถึงจะเฉลยคำอธิบายให้ (ตอบถูกแล้วเห็นคำอธิบายเสมอ)
REVEAL_AFTER_ATTEMPTS = 3


def _progress_row(db: Session, user_id: str, lesson_id: str) -> LessonProgress | None:
    return db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id, LessonProgress.lesson_id == lesson_id
        )
    )


def _mark_lesson(db: Session, user_id: str, lesson_id: str, completed: bool) -> LessonProgress:
    """ตั้งสถานะบทเรียน: completed=True → เรียนจบ (ไม่ถอยกลับเป็น in_progress ถ้าเคยจบแล้ว)"""
    row = _progress_row(db, user_id, lesson_id)
    if row is None:
        row = LessonProgress(user_id=user_id, lesson_id=lesson_id, status="in_progress")
        db.add(row)
    if completed and row.status != "completed":
        row.status = "completed"
        row.completed_at = datetime.now(timezone.utc)
    return row


def _passed_exercise_ids(db: Session, user_id: str, exercise_ids: list[str]) -> set[str]:
    if not exercise_ids:
        return set()
    return set(
        db.scalars(
            select(Submission.exercise_id)
            .where(
                Submission.user_id == user_id,
                Submission.exercise_id.in_(exercise_ids),
                Submission.passed.is_(True),
            )
            .distinct()
        ).all()
    )


@router.post("/lessons/{lesson_id}/complete")
def complete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if db.get(Lesson, lesson_id) is None:
        raise HTTPException(404, "Lesson not found")

    row = _mark_lesson(db, user.id, lesson_id, completed=True)
    db.commit()
    return {"status": row.status, "completed_at": row.completed_at}


@router.post("/exercises/{exercise_id}/submit")
def submit_exercise(
    exercise_id: str,
    body: SubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    retry_after = submit_limiter.check(user.id)
    if retry_after:
        raise HTTPException(
            429,
            "ส่งคำตอบถี่เกินไป รอสักครู่แล้วลองใหม่",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(404, "Exercise not found")

    case_results: list[dict] | None = None
    run_result: dict | None = None
    if exercise.kind == "mcq":
        valid_ids = {option["id"] for option in (exercise.options or [])}
        if body.answer not in valid_ids:
            raise HTTPException(422, "ตัวเลือกไม่ถูกต้อง")
        passed = grading.grade_mcq(exercise.correct_option_id, body.answer)
    elif exercise.kind == "code":
        cases = exercise.test_cases or []
        if not (body.answer or "").strip():
            raise HTTPException(422, "ไม่พบโค้ดที่ส่งมา")
        if body.outputs is None or len(body.outputs) != len(cases):
            raise HTTPException(422, "จำนวนผลลัพธ์ไม่ตรงกับจำนวนข้อทดสอบ")
        case_results = grading.grade_code(cases, body.outputs)
        passed = bool(case_results) and all(result["passed"] for result in case_results)
        run_result = {"outputs": body.outputs}
    else:
        raise HTTPException(400, "Unsupported exercise kind")

    attempts_before = db.scalar(
        select(func.count(Submission.id)).where(
            Submission.user_id == user.id, Submission.exercise_id == exercise.id
        )
    ) or 0
    passed_before = (
        db.scalar(
            select(func.count(Submission.id)).where(
                Submission.user_id == user.id,
                Submission.exercise_id == exercise.id,
                Submission.passed.is_(True),
            )
        )
        or 0
    ) > 0

    # ได้คะแนนเฉพาะครั้งแรกที่ตอบถูก — ตอบซ้ำฝึกเล่นได้แต่ไม่บวกคะแนนเพิ่ม
    awarded = exercise.points if passed and not passed_before else 0
    db.add(
        Submission(
            user_id=user.id,
            exercise_id=exercise.id,
            answer=body.answer,
            passed=passed,
            score=awarded,
            run_result=run_result,
        )
    )
    db.flush()

    lesson_ids = db.scalars(select(Exercise.id).where(Exercise.lesson_id == exercise.lesson_id)).all()
    all_passed = set(lesson_ids) <= _passed_exercise_ids(db, user.id, list(lesson_ids))
    row = _mark_lesson(db, user.id, exercise.lesson_id, completed=all_passed)
    db.commit()

    attempts = attempts_before + 1
    reveal = passed or attempts >= REVEAL_AFTER_ATTEMPTS
    failed_cases = (
        [
            {"index": index, "expected": result["expected"]}
            for index, result in enumerate(case_results)
            if not result["passed"]
        ]
        if case_results is not None
        else None
    )
    return {
        "passed": passed,
        "points": exercise.points,
        "awarded": awarded,
        "attempts": attempts,
        "explanation": exercise.explanation if reveal else None,
        "correct_option_id": exercise.correct_option_id if (exercise.kind == "mcq" and reveal) else None,
        "cases": [result["passed"] for result in case_results] if case_results is not None else None,
        "failed_cases": failed_cases,
        "lesson_status": row.status,
    }


@router.get("/lessons/{lesson_id}")
def lesson_progress(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """สถานะของผู้เรียนในบทเรียนนี้: เรียนจบหรือยัง และแต่ละข้อผ่านหรือยัง ได้กี่คะแนน"""
    if db.get(Lesson, lesson_id) is None:
        raise HTTPException(404, "Lesson not found")

    row = _progress_row(db, user.id, lesson_id)
    exercises = db.scalars(select(Exercise).where(Exercise.lesson_id == lesson_id)).all()
    stats = {
        exercise_id: {"attempts": attempts, "passed": bool(passed), "score": int(score)}
        for exercise_id, attempts, passed, score in db.execute(
            select(
                Submission.exercise_id,
                func.count(Submission.id),
                func.bool_or(Submission.passed),
                func.coalesce(func.sum(Submission.score), 0),
            )
            .where(
                Submission.user_id == user.id,
                Submission.exercise_id.in_([exercise.id for exercise in exercises]),
            )
            .group_by(Submission.exercise_id)
        ).all()
    }
    empty = {"attempts": 0, "passed": False, "score": 0}
    return {
        "status": row.status if row else "not_started",
        "exercises": {exercise.id: stats.get(exercise.id, empty) for exercise in exercises},
    }


@router.get("/courses/{course_slug}")
def course_progress(
    course_slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """ความคืบหน้าต่อบทเรียนในคอร์ส (ใช้แสดงเครื่องหมายถูกในหน้ารายการบทเรียน)"""
    course = db.scalar(select(Course).where(Course.slug == course_slug))
    if course is None:
        raise HTTPException(404, "Course not found")

    lessons = db.scalars(
        select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.sort_order)
    ).all()
    lesson_ids = [lesson.id for lesson in lessons]

    status_by_lesson = dict(
        db.execute(
            select(LessonProgress.lesson_id, LessonProgress.status).where(
                LessonProgress.user_id == user.id, LessonProgress.lesson_id.in_(lesson_ids)
            )
        ).all()
    )
    totals = dict(
        db.execute(
            select(Exercise.lesson_id, func.count(Exercise.id))
            .where(Exercise.lesson_id.in_(lesson_ids))
            .group_by(Exercise.lesson_id)
        ).all()
    )
    passed_counts = dict(
        db.execute(
            select(Exercise.lesson_id, func.count(func.distinct(Submission.exercise_id)))
            .join(Submission, Submission.exercise_id == Exercise.id)
            .where(
                Exercise.lesson_id.in_(lesson_ids),
                Submission.user_id == user.id,
                Submission.passed.is_(True),
            )
            .group_by(Exercise.lesson_id)
        ).all()
    )
    scores = dict(
        db.execute(
            select(Exercise.lesson_id, func.coalesce(func.sum(Submission.score), 0))
            .join(Submission, Submission.exercise_id == Exercise.id)
            .where(Exercise.lesson_id.in_(lesson_ids), Submission.user_id == user.id)
            .group_by(Exercise.lesson_id)
        ).all()
    )
    return {
        "lessons": [
            {
                "lesson_id": lesson.id,
                "slug": lesson.slug,
                "status": status_by_lesson.get(lesson.id, "not_started"),
                "exercises_total": totals.get(lesson.id, 0),
                "exercises_passed": passed_counts.get(lesson.id, 0),
                "score": int(scores.get(lesson.id, 0)),
            }
            for lesson in lessons
        ]
    }


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
    exercises_passed = (
        db.scalar(
            select(func.count(func.distinct(Submission.exercise_id))).where(
                Submission.user_id == user.id, Submission.passed.is_(True)
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
        "exercises_passed": exercises_passed,
        "recent_lessons": [{"id": r.id, "title": r.title} for r in recent],
    }
