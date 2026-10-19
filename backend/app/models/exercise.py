from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, uuid_pk


class Exercise(Base, TimestampMixin):
    __tablename__ = "exercises"

    id: Mapped[str] = uuid_pk()
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"))
    # "mcq" = ปรนัย | "code" = เขียนโค้ดให้ผ่าน test case
    kind: Mapped[str] = mapped_column(String(20), default="mcq")
    prompt: Mapped[str] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer, default=10)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # mcq: [{"id": "a", "text": "..."}]
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    correct_option_id: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # code: [{"input": "...", "expected": "...", "hidden": false}]
    test_cases: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)

    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), index=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    # ผลรันจากฝั่ง browser ส่งมาเก็บไว้ดูย้อนหลัง (ไม่ใช้ตัดสินคะแนน mcq)
    run_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
