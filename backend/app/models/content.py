from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, uuid_pk


class Language(Base):
    """ภาษาโปรแกรม เช่น python, javascript"""

    __tablename__ = "languages"

    id: Mapped[str] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    # runtime ที่ playground ใช้รันฝั่ง browser: "pyodide" | "js" | None (อ่านอย่างเดียว)
    runtime: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    id: Mapped[str] = uuid_pk()
    language_id: Mapped[str] = mapped_column(ForeignKey("languages.id", ondelete="CASCADE"))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(20), default="beginner")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("course_id", "slug"),)

    id: Mapped[str] = uuid_pk()
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    slug: Mapped[str] = mapped_column(String(120), index=True)
    title: Mapped[str] = mapped_column(String(200))
    content_md: Mapped[str] = mapped_column(Text, default="")
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
