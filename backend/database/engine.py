"""
Aura Finance — Async Database Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Development : SQLite (aiosqlite) — zero setup, file-based, instant start.
Production  : PostgreSQL (asyncpg) — just change DATABASE_URL in .env.

DATABASE_URL examples:
  sqlite+aiosqlite:///./aura_finance.db          ← default (dev)
  postgresql+asyncpg://user:pw@host:5432/dbname  ← production
"""

import logging
import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv()

logger = logging.getLogger(__name__)

# ── URL resolution ────────────────────────────────────────────────────────────
# DATABASE_URL 미설정 시 로컬 SQLite 사용. 프로덕션은 PostgreSQL 설정.
_raw_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./aura_finance.db").strip()

# Render/Heroku는 postgres:// 반환. SQLAlchemy async는 postgresql+asyncpg:// 필요.
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _raw_url

# ── Engine ────────────────────────────────────────────────────────────────────
_is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    # SQLite: single-file DB needs check_same_thread=False
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # PostgreSQL: connection pool sizing
    **({} if _is_sqlite else {"pool_size": 10, "max_overflow": 20}),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

logger.info(f"🗄️  Database engine: {'SQLite (dev)' if _is_sqlite else 'PostgreSQL'}")


# ── Session dependency (FastAPI Depends) ──────────────────────────────────────
async def get_db():
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Table creation ────────────────────────────────────────────────────────────
def _migrate_transactions_add_bank_connection_id(sync_conn):
    """Add bank_connection_id to transactions if missing (SQLite migration)."""
    from sqlalchemy import text
    try:
        result = sync_conn.execute(text("PRAGMA table_info(transactions)"))
        cols = [row[1] for row in result.fetchall()]
        if "bank_connection_id" not in cols:
            sync_conn.execute(text("ALTER TABLE transactions ADD COLUMN bank_connection_id VARCHAR(36)"))
            logger.info("✅ Migration: added bank_connection_id to transactions")
    except Exception as e:
        logger.warning(f"Migration skip (non-SQLite or already migrated): {e}")


def _migrate_users_add_lockout_fields(sync_conn):
    """Add failed_login_attempts and locked_until to users (brute-force defense)."""
    from sqlalchemy import text
    try:
        result = sync_conn.execute(text("PRAGMA table_info(users)"))
        cols = [row[1] for row in result.fetchall()]
        if "failed_login_attempts" not in cols:
            sync_conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
            logger.info("✅ Migration: added failed_login_attempts to users")
        if "locked_until" not in cols:
            sync_conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
            logger.info("✅ Migration: added locked_until to users")
    except Exception as e:
        logger.warning(f"Migration skip (non-SQLite or already migrated): {e}")


def _migrate_users_add_reset_token_fields(sync_conn):
    """Add reset_token and reset_token_expires to users (password reset)."""
    from sqlalchemy import text
    try:
        result = sync_conn.execute(text("PRAGMA table_info(users)"))
        cols = [row[1] for row in result.fetchall()]
        if "reset_token" not in cols:
            sync_conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(64)"))
            logger.info("✅ Migration: added reset_token to users")
        if "reset_token_expires" not in cols:
            sync_conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expires DATETIME"))
            logger.info("✅ Migration: added reset_token_expires to users")
    except Exception as e:
        logger.warning(f"Migration skip (non-SQLite or already migrated): {e}")


async def init_db() -> None:
    """Create all tables if they don't already exist (idempotent)."""
    from .models import Base  # avoid circular import at module level

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if _is_sqlite:
            await conn.run_sync(_migrate_transactions_add_bank_connection_id)
            await conn.run_sync(_migrate_users_add_lockout_fields)
            await conn.run_sync(_migrate_users_add_reset_token_fields)
    logger.info("✅ Database tables initialised")
