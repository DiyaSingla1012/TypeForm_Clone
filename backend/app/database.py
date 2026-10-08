from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIRECTORY = Path(__file__).resolve().parents[1] / "data"
DATA_DIRECTORY.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite:///{DATA_DIRECTORY / 'typeform.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def migrate_schema() -> None:
    """Small SQLite migration for installs created before bonus settings existed."""
    columns = {column["name"] for column in inspect(engine).get_columns("forms")}
    if "appearance" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE forms ADD COLUMN appearance JSON NOT NULL DEFAULT '{}'"))
