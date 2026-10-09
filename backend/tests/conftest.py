"""Shared isolated infrastructure for FastAPI API tests."""

import os
import shutil
import tempfile
import uuid
from pathlib import Path

# Set these before app modules are imported. This keeps tests away from the
# developer's backend/data/typeform.db and backend/data/uploads directories.
TEST_ROOT = Path(tempfile.gettempdir()) / f"typeform-builder-tests-{uuid.uuid4().hex}"
TEST_ROOT.mkdir(parents=True)
os.environ["TYPEFORM_DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["TYPEFORM_UPLOAD_DIRECTORY"] = str(TEST_ROOT / "uploads")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture
def client():
    """Return a client with a brand-new seeded SQLite database per test."""
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)


def pytest_sessionfinish(session, exitstatus):
    """Remove the temporary test database and uploaded test files."""
    engine.dispose()
    shutil.rmtree(TEST_ROOT, ignore_errors=True)
