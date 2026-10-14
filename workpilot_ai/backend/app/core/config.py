from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "WorkPilot AI"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "workpilot-super-secret-key-enterprise-ai-pm-platform-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Defaults to SQLite for zero-friction out-of-the-box local operation; configurable to PostgreSQL
    DATABASE_URL: str = "sqlite:///./workpilot.db"
    
    # LLM Settings (optional - fallback to deterministic heuristic planner when absent)
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    # Twilio Verify (SMS signup verification)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_VERIFY_SERVICE_SID: Optional[str] = None
    MANAGER_SIGNUP_INVITE_CODE: Optional[str] = None
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
