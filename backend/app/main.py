import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  ทำให้ SQLAlchemy รู้จักทุกตารางก่อนสร้าง
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.services.seed import seed_if_empty

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.AUTO_CREATE_TABLES:
        # สร้างตารางที่ยังไม่มี (ไม่แก้ตารางเดิม) — พอสำหรับ MVP
        Base.metadata.create_all(bind=engine)
    if settings.AUTO_SEED:
        try:
            seed_if_empty()
        except Exception:  # seed พังไม่ควรทำให้ทั้งระบบล่ม
            logger.exception("seed failed")
    yield


app = FastAPI(
    title="AI Code Learn API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=False,  # ใช้ Bearer token ไม่ใช่ cookie
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    """ใช้ปลุก instance ที่หลับอยู่ + ให้ frontend เช็คก่อนโหลดหน้า"""
    return {"status": "ok"}
