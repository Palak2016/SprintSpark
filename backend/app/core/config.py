from pathlib import Path
from typing import List, Optional
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "WorkPilot AI"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "workpilot-super-secret-key-enterprise-ai-pm-platform-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Defaults to SQLite for zero-friction out-of-the-box local operation; configurable to PostgreSQL
    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'workpilot.db').as_posix()}"
    
    # LLM settings used by AI analysis and recovery planning.
    OPENAI_API_KEY: Optional[str] = None
    WAYJET_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    # The application defaults to Gemini; override only when choosing another provider.
    LLM_PROVIDER: Optional[str] = "gemini"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    WAYJET_MODEL: str = "gpt-5.1"
    WAYJET_BASE_URL: str = "https://api.wayjet.ai/v1"
    GEMINI_MODEL: str = "gemini-3.6-flash"
    LLM_TIMEOUT_SECONDS: float = 20.0

    # Initial agenda-drift thresholds. Scores below the partial threshold are
    # considered potentially off track only when semantic confidence is adequate.
    AGENDA_DRIFT_ALIGNED_THRESHOLD: int = Field(default=80, ge=1, le=100)
    AGENDA_DRIFT_PARTIAL_THRESHOLD: int = Field(default=50, ge=0, le=99)
    AGENDA_DRIFT_MIN_CONFIDENCE: int = Field(default=60, ge=1, le=100)

    # Business timezone for "today" in risk scoring (due dates, overdue,
    # daily recalculation). Use an IANA name such as "Asia/Kolkata".
    RISK_TIMEZONE: str = "Asia/Kolkata"

    # SMTP email verification
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_SSL: bool = False
    SMTP_STARTTLS: bool = True
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    ENVIRONMENT: str = "development"

    # Used to build Company Portal invitation links.
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_agenda_drift_thresholds(self):
        if self.AGENDA_DRIFT_PARTIAL_THRESHOLD >= self.AGENDA_DRIFT_ALIGNED_THRESHOLD:
            raise ValueError(
                "AGENDA_DRIFT_PARTIAL_THRESHOLD must be lower than "
                "AGENDA_DRIFT_ALIGNED_THRESHOLD."
            )
        return self


settings = Settings()
