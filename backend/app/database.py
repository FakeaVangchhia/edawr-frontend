"""Database engine, session factory, and the `get_db` dependency.

The important idea here is `get_db`. FastAPI calls it for every request that
asks for it, hands the route a live session, and closes that session when the
response is finished -- even if the route raised. Routes never open or close
connections themselves.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# `check_same_thread` is a SQLite-only quirk: SQLite normally refuses to use a
# connection from a different thread, and FastAPI runs sync routes in a
# threadpool. Drop this arg when you move to Postgres.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)


if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        """Turn on foreign key enforcement for every SQLite connection.

        SQLite ships with foreign keys DISABLED and the setting is per-connection,
        not per-database. Without this, every `ForeignKey(..., ondelete=...)` in
        models.py is decorative: deleting a product leaves order_items rows
        pointing at a row that no longer exists, and because SQLite reuses freed
        rowids a future insert can silently adopt those orphaned references.

        Postgres enforces foreign keys natively, so this is SQLite-only.
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Parent class for every ORM model."""


def get_db() -> Generator[Session, None, None]:
    """Yield a database session, then guarantee it is closed.

    Used as a dependency:  db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
