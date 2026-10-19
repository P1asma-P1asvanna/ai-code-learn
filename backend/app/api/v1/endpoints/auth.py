from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter()


class GithubSyncIn(BaseModel):
    github_id: str
    username: str
    email: str | None = None
    avatar_url: str | None = None


class TokenOut(BaseModel):
    access_token: str
    user_id: str


@router.post("/github", response_model=TokenOut)
def sync_github_user(
    payload: GithubSyncIn,
    db: Session = Depends(get_db),
    x_internal_secret: str = Header(default=""),
):
    """เรียกจาก Next.js server เท่านั้น (ไม่ใช่จาก browser)"""
    if x_internal_secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    user = db.scalar(select(User).where(User.github_id == payload.github_id))
    if user is None:
        user = User(**payload.model_dump())
        db.add(user)
    else:
        user.username = payload.username
        user.email = payload.email
        user.avatar_url = payload.avatar_url
    db.commit()

    return TokenOut(access_token=create_access_token(user.id), user_id=user.id)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }
