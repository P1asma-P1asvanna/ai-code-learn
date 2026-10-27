from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # จำเป็นมากกับ Neon/Supabase ที่ตัด connection ที่ idle
    pool_size=5,
    max_overflow=5,
    # ปิด prepared statement ฝั่ง driver เพื่อให้ใช้ได้ทั้งสายตรงและสาย "pooled" (PgBouncer) ของ Neon/Supabase
    connect_args={"prepare_threshold": None},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
