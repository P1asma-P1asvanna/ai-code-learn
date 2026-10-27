import json

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "dev" หรือ "production" — production จะเข้มงวดเรื่อง secret และปิดหน้า /docs
    APP_ENV: str = "dev"

    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/ailearn"
    # สร้างตารางอัตโนมัติตอนเริ่มระบบ (ไม่ต้องรัน migration ด้วยมือ)
    AUTO_CREATE_TABLES: bool = True
    # ใส่บทเรียนตัวอย่างตอนเริ่มระบบ ถ้าฐานข้อมูลยังว่าง
    AUTO_SEED: bool = False

    # secret ตัวนี้ต้องตรงกับ BACKEND_JWT_SECRET ฝั่ง Vercel (Next.js เป็นคนเซ็น token)
    JWT_SECRET: str = _DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"

    CORS_ORIGINS: str = "http://localhost:3000"

    # ---------- AI ตรวจโค้ด (ใช้ provider ไหนก็ได้ที่เข้ากันกับ OpenAI chat completions) ----------
    AI_ENABLED: bool = True
    AI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    AI_API_KEY: str = ""
    # ใส่ได้หลายชื่อคั่นด้วย , — ถ้าชื่อแรกถูกปลดระวาง (provider ตอบ 404) ระบบจะลองชื่อถัดไปเอง
    # "-latest" เป็นชื่อเรียกที่ Google ชี้ไปรุ่น Flash ล่าสุดให้เสมอ จึงไม่ต้องตามแก้ชื่อรุ่นบ่อย
    AI_MODEL: str = "gemini-flash-lite-latest,gemini-flash-latest,gemini-3.1-flash-lite"
    # JSON object ที่จะผสมเข้าไปในคำขอ เช่น {"reasoning_effort":"low"} (เว้นว่างได้)
    AI_EXTRA_BODY: str = ""
    AI_JSON_MODE: bool = True
    AI_TIMEOUT_SECONDS: float = 25.0
    AI_MAX_CODE_CHARS: int = 6000
    # รุ่นที่ "คิดก่อนตอบ" นับ token ที่คิดรวมในเพดานนี้ด้วย ตั้งต่ำไปคำตอบ JSON จะถูกตัดกลางคัน
    AI_MAX_OUTPUT_TOKENS: int = 4096
    AI_PER_MINUTE_LIMIT: int = 10
    AI_DAILY_REQUEST_LIMIT: int = 60
    AI_GLOBAL_DAILY_LIMIT: int = 800

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        # connection string จาก Neon/Supabase ขึ้นต้นด้วย postgresql:// — แปลงให้ใช้ driver psycopg อัตโนมัติ
        value = value.strip()
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if self.is_production and (self.JWT_SECRET == _DEFAULT_JWT_SECRET or len(self.JWT_SECRET) < 32):
            raise ValueError("JWT_SECRET ต้องตั้งเป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษรเมื่อ APP_ENV=production")
        if self.AI_EXTRA_BODY.strip():
            try:
                parsed = json.loads(self.AI_EXTRA_BODY)
            except json.JSONDecodeError as exc:
                raise ValueError("AI_EXTRA_BODY ต้องเป็น JSON") from exc
            if not isinstance(parsed, dict):
                raise ValueError("AI_EXTRA_BODY ต้องเป็น JSON object")
        return self

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def ai_extra_body(self) -> dict:
        return json.loads(self.AI_EXTRA_BODY) if self.AI_EXTRA_BODY.strip() else {}

    @property
    def ai_configured(self) -> bool:
        return self.AI_ENABLED and bool(self.AI_API_KEY.strip())


settings = Settings()
