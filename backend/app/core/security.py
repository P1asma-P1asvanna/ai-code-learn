"""
การยืนยันตัวตน: Next.js (Auth.js) เป็นคนล็อกอินกับ GitHub แล้วเซ็น JWT ด้วย secret ที่ใช้ร่วมกับ backend
backend แค่ตรวจลายเซ็น แล้วสร้างแถวผู้ใช้ให้อัตโนมัติเมื่อเจอครั้งแรก
(ไม่ต้องให้ backend ตื่นตอนล็อกอิน — สำคัญเพราะ Render free tier หลับอยู่)
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            # ไม่ตรวจ iat: นาฬิกาของ Vercel (คนเซ็น) กับ Render (คนตรวจ) คลาดกันได้ไม่กี่วินาที
            # ทำให้ token ที่เพิ่งออกถูกมองว่า "ยังไม่ถึงเวลา" จนล็อกอินแล้วโดน 401 เป็นพัก ๆ — ความปลอดภัยพึ่ง exp + ลายเซ็นอยู่แล้ว
            options={"require": ["exp", "sub"], "verify_iat": False},
        )
    except jwt.PyJWTError:
        raise _unauthorized("Invalid token")


def _get_or_create_user(db: Session, github_id: str, username: str, avatar: str | None) -> User:
    user = db.scalar(select(User).where(User.github_id == github_id))
    if user is None:
        user = User(github_id=github_id, username=username, avatar_url=avatar)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # คำขอสองอันมาพร้อมกันในครั้งแรก — อีกอันสร้างไปแล้ว
            db.rollback()
            user = db.scalar(select(User).where(User.github_id == github_id))
            if user is None:
                raise
    elif user.username != username or user.avatar_url != avatar:
        user.username = username
        user.avatar_url = avatar
        db.commit()
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized("Missing token")
    claims = decode_token(creds.credentials)

    github_id = str(claims["sub"]).strip()
    if not github_id:
        raise _unauthorized("Invalid token")
    username = str(claims.get("login") or "user")[:100]
    picture = claims.get("picture")
    avatar = str(picture)[:500] if picture else None
    return _get_or_create_user(db, github_id, username, avatar)
