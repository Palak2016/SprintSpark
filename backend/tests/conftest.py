import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app
from tests.seed_service import seed_database
from app.core.security import create_access_token

# Test database
TEST_DB_URL = "sqlite:///./test_workpilot.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Auth rate limits are in-process; start every test with clean counters."""
    from app.core import rate_limit

    rate_limit.reset()
    yield
    rate_limit.reset()


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    """Tests never call a hosted model, even if backend/.env has a key.

    Tests that exercise the AI path inject a fake model explicitly.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "RECOVERY_REQUIRE_LLM", False)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    from app.core.config import settings

    # The seed runs the recovery workflow; keep it on the rule-based path.
    settings.OPENAI_API_KEY = None
    settings.GEMINI_API_KEY = None
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db, force_reset=True)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def manager_token():
    return create_access_token(subject=1, role="MANAGER")


@pytest.fixture
def employee_token():
    return create_access_token(subject=2, role="EMPLOYEE")
