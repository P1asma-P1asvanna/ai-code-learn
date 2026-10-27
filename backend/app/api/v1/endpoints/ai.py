import logging
import math
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.progress import AiUsage
from app.models.user import User
from app.services import ai_review
from app.services.rate_limit import SlidingWindowLimiter

router = APIRouter()
logger = logging.getLogger(__name__)

minute_limiter = SlidingWindowLimiter(limit=settings.AI_PER_MINUTE_LIMIT, window_seconds=60.0)


class ReviewIn(BaseModel):
    language: str = Field(pattern=r"^[a-z0-9+#.\-]{1,20}$")
    code: str = Field(min_length=1, max_length=50000)
    last_output: str | None = Field(default=None, max_length=10000)


class ReviewIssue(BaseModel):
    line: int | None
    severity: str
    message: str


class ReviewOut(BaseModel):
    summary: str
    issues: list[ReviewIssue]
    remaining_today: int


class StatusOut(BaseModel):
    enabled: bool
    daily_limit: int
    max_code_chars: int


def _error(status_code: int, code: str, message: str, headers: dict[str, str] | None = None) -> HTTPException:
    # detail เป็น object {code, message} เพื่อให้ frontend แยกแยะชนิด error ได้
    return HTTPException(status_code, {"code": code, "message": message}, headers=headers)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _reserve_daily_request(db: Session, user_id: str) -> tuple[int, date]:
    """จองโควต้า 1 ครั้งก่อนเรียก AI (กันยิงขนานกันเพื่อเลี่ยงโควต้า)"""
    today = _today()

    total_today = db.scalar(
        select(func.coalesce(func.sum(AiUsage.requests), 0)).where(AiUsage.usage_date == today)
    ) or 0
    if total_today >= settings.AI_GLOBAL_DAILY_LIMIT:
        raise _error(503, "global_quota", "โควต้า AI ของระบบวันนี้เต็มแล้ว ลองใหม่พรุ่งนี้นะ")

    stmt = (
        pg_insert(AiUsage)
        .values(user_id=user_id, usage_date=today, requests=1, tokens=0)
        .on_conflict_do_update(
            index_elements=[AiUsage.user_id, AiUsage.usage_date],
            set_={"requests": AiUsage.requests + 1},
        )
        .returning(AiUsage.requests)
    )
    count = db.execute(stmt).scalar_one()
    if count > settings.AI_DAILY_REQUEST_LIMIT:
        db.rollback()  # ไม่นับครั้งที่ถูกปฏิเสธ
        raise _error(
            429,
            "daily_quota",
            f"วันนี้คุณใช้ AI ตรวจโค้ดครบ {settings.AI_DAILY_REQUEST_LIMIT} ครั้งแล้ว พรุ่งนี้มาใหม่นะ",
        )
    db.commit()
    return count, today


def _refund_daily_request(db: Session, user_id: str, today: date) -> None:
    db.execute(
        update(AiUsage)
        .where(AiUsage.user_id == user_id, AiUsage.usage_date == today)
        .values(requests=func.greatest(AiUsage.requests - 1, 0))
    )
    db.commit()


def _add_tokens(db: Session, user_id: str, today: date, tokens: int) -> None:
    if tokens <= 0:
        return
    db.execute(
        update(AiUsage)
        .where(AiUsage.user_id == user_id, AiUsage.usage_date == today)
        .values(tokens=AiUsage.tokens + tokens)
    )
    db.commit()


@router.get("/status", response_model=StatusOut)
def ai_status():
    """ให้หน้าเว็บรู้ว่าระบบ AI เปิดอยู่ไหม (ไม่เผยข้อมูลลับ)"""
    return StatusOut(
        enabled=settings.ai_configured,
        daily_limit=settings.AI_DAILY_REQUEST_LIMIT,
        max_code_chars=settings.AI_MAX_CODE_CHARS,
    )


@router.post("/review", response_model=ReviewOut)
def review_code(
    payload: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not settings.ai_configured:
        raise _error(503, "ai_disabled", "ระบบ AI ตรวจโค้ดยังไม่ได้เปิดใช้งาน")
    if len(payload.code) > settings.AI_MAX_CODE_CHARS:
        raise _error(
            413,
            "code_too_long",
            f"โค้ดยาวเกินไปสำหรับ AI ตรวจ (สูงสุด {settings.AI_MAX_CODE_CHARS} ตัวอักษร)",
        )

    wait = minute_limiter.check(user.id)
    if wait > 0:
        seconds = math.ceil(wait)
        raise _error(
            429,
            "rate_limited",
            f"ส่งถี่เกินไป รออีกประมาณ {seconds} วินาทีแล้วลองใหม่",
            headers={"Retry-After": str(seconds)},
        )

    count, today = _reserve_daily_request(db, user.id)

    messages = ai_review.build_messages(payload.language, payload.code, payload.last_output)
    try:
        raw, tokens = ai_review.call_chat_completion(
            base_url=settings.AI_BASE_URL,
            api_key=settings.AI_API_KEY,
            model=settings.AI_MODEL,
            messages=messages,
            max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
            timeout=settings.AI_TIMEOUT_SECONDS,
            json_mode=settings.AI_JSON_MODE,
            extra_body=settings.ai_extra_body,
        )
    except ai_review.AiProviderBusy:
        _refund_daily_request(db, user.id, today)
        raise _error(503, "provider_busy", "AI กำลังมีผู้ใช้งานหนาแน่น ลองใหม่อีกสักครู่นะ")
    except ai_review.AiProviderError as exc:
        # log เฉพาะสาเหตุ ไม่ log โค้ดของผู้เรียนและไม่ log API key
        logger.warning("AI provider error: %s", exc)
        _refund_daily_request(db, user.id, today)
        raise _error(502, "provider_error", "ติดต่อ AI ไม่สำเร็จ ลองใหม่อีกครั้งนะ")

    _add_tokens(db, user.id, today, tokens)
    result = ai_review.parse_review(raw, line_count=ai_review.count_lines(payload.code))
    return ReviewOut(
        summary=result["summary"],
        issues=[ReviewIssue(**issue) for issue in result["issues"]],
        remaining_today=max(settings.AI_DAILY_REQUEST_LIMIT - count, 0),
    )
