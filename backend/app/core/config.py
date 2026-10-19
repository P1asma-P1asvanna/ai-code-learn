from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost:5432/ailearn"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    # กันไม่ให้ใครยิง /auth/github ตรง ๆ ได้ — เฉพาะ Next.js server เท่านั้นที่รู้ค่านี้
    INTERNAL_API_SECRET: str = "change-me-too"

    CORS_ORIGINS: str = "http://localhost:3000"

    GEMINI_API_KEY: str = ""
    AI_DAILY_TOKEN_LIMIT: int = 20000

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
