from fastapi import APIRouter

from app.api.v1.endpoints import auth, lessons, progress

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(lessons.router, prefix="/content", tags=["content"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
