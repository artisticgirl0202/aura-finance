"""
Aura Finance — JWT Authentication Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security design:
  Access token  : short-lived JWT (30 min)  — sent in Authorization header
  Refresh token : long-lived JWT (7 days)   — stored in httpOnly cookie (production)
                                              stored in localStorage (dev simplicity)

JWT payload:
  sub      → user_id (UUID string)
  email    → user email
  exp      → expiration timestamp
  iat      → issued-at timestamp
  type     → "access" | "refresh"

Password hashing: bcrypt via passlib (cost factor 12)
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

load_dotenv()

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
# SECRET_KEY: 프로덕션 필수. 개발 시에만 기본값 사용 (ENV=development)
_dev_secret = "dev-secret-key-change-in-production-32chars!"
_SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
SECRET_KEY = _SECRET_KEY if _SECRET_KEY else (
    _dev_secret if os.getenv("ENV", "production") == "development" else None
)
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY must be set in .env for production. "
        "Generate with: openssl rand -hex 32"
    )
ALGORITHM       = os.getenv("ALGORITHM", "HS256")
ACCESS_EXPIRE   = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_EXPIRE  = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",   "7"))

# bcrypt: truncate_error=False so backend never raises on long passwords.
# We pre-truncate to 72 UTF-8 bytes before hashing.
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=False,
)

BCRYPT_MAX_BYTES = 72  # bcrypt input limit


def _extract_password_str(value) -> str:
    """
    Extract plain string from password input.
    Handles SecretStr (.get_secret_value()), ensures str, rejects dict/model.
    """
    if value is None:
        raise TypeError("Password cannot be None")
    if hasattr(value, "get_secret_value"):
        return value.get_secret_value()
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list)):
        raise TypeError(f"Password must be str, got {type(value).__name__} (likely whole payload)")
    # Pydantic model etc. - str() would produce long repr, reject explicitly
    if hasattr(value, "model_dump") or hasattr(value, "dict"):
        raise TypeError(f"Password must be str, got {type(value).__name__} (Pydantic model?)")
    raise TypeError(f"Password must be str, got {type(value).__name__}")


def _truncate_password_for_bcrypt(plain: str) -> str:
    """
    Ensure password is at most 72 UTF-8 bytes for bcrypt.
    Prevents 'password cannot be longer than 72 bytes' from bcrypt backend.
    Safely truncates without cutting multi-byte characters.
    """
    if not isinstance(plain, str):
        raise TypeError(f"Password must be str, got {type(plain).__name__}")
    if not plain:
        return plain
    encoded = plain.encode("utf-8")
    if len(encoded) <= BCRYPT_MAX_BYTES:
        return plain
    # Truncate at 72 bytes; avoid cutting multi-byte UTF-8 sequence
    truncated = encoded[:BCRYPT_MAX_BYTES]
    # Decode, discarding incomplete trailing byte sequences
    return truncated.decode("utf-8", errors="ignore").rstrip("\ufffd") or plain[:1]


# ── Password helpers ──────────────────────────────────────────────────────────

def extract_password_for_hashing(value) -> str:
    """
    Extract plain string from password input for hashing.
    Handles SecretStr, rejects dict/model. Use before passing to hash_password.
    """
    return _extract_password_str(value)


def hash_password(plain) -> str:
    """
    Hash password with bcrypt.
    Extracts str (SecretStr), truncates to 72 UTF-8 bytes, then hashes.
    """
    raw = _extract_password_str(plain)
    safe = _truncate_password_for_bcrypt(raw)
    # Debug: Render 터미널에서 정확한 원인 확인용
    preview = str(safe)[:15] + ("..." if len(safe) > 15 else "")
    logger.info("Hashing debug - Length: %d, Type: %s, Preview: %s", len(safe), type(plain).__name__, preview)
    print(f"🔥 Hashing debug - Length: {len(safe)}, Type: {type(plain).__name__}, Preview: {preview}...")
    return pwd_context.hash(safe)


def verify_password(plain, hashed: str) -> bool:
    """Verify password. Extracts str (SecretStr), truncates to match hashing."""
    raw = _extract_password_str(plain)
    safe = _truncate_password_for_bcrypt(raw)
    return pwd_context.verify(safe, hashed)


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   user_id,
        "email": email,
        "type":  "access",
        "iat":   now,
        "exp":   now + timedelta(minutes=ACCESS_EXPIRE),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":  user_id,
        "type": "refresh",
        "iat":  now,
        "exp":  now + timedelta(days=REFRESH_EXPIRE),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── Token validation ──────────────────────────────────────────────────────────

def decode_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT.
    Returns the payload dict, or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as exc:
        logger.debug(f"Token validation failed: {exc}")
        return None


def get_user_id_from_token(token: str) -> Optional[str]:
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload.get("sub")
    return None


# ── FastAPI dependency: current user ─────────────────────────────────────────

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)

# Special token for guest mode — read-only demo, no DB mutations
GUEST_TOKEN = "guest-token"


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """
    FastAPI dependency that extracts user_id from the Bearer JWT.
    Raises 401 if token is missing, invalid, or expired.

    Usage:
        @router.get("/protected")
        async def protected(user_id: str = Depends(get_current_user_id)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = get_user_id_from_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[str]:
    """
    Like get_current_user_id but returns None instead of raising 401.
    Returns "guest" when Bearer guest-token is sent (read-only demo mode).
    Use for endpoints that work for both authenticated and anonymous users.
    """
    if credentials is None:
        return None
    cred = credentials.credentials
    if cred == GUEST_TOKEN:
        return "guest"
    return get_user_id_from_token(cred)


# ── User DB operations ────────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str):
    from database.models import UserRecord
    stmt = select(UserRecord).where(UserRecord.email == email.lower().strip())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str):
    from database.models import UserRecord
    return await db.get(UserRecord, user_id)


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    display_name: str,
    password: str,
    currency: str = "USD",
    monthly_income: float = 0.0,
):
    import uuid
    from database.models import UserRecord

    existing = await get_user_by_email(db, email)
    if existing:
        raise ValueError(f"Email already registered: {email}")

    user = UserRecord(
        id=str(uuid.uuid4()),
        email=email.lower().strip(),
        display_name=display_name,
        password_hash=hash_password(password),
        currency=currency,
        monthly_income=monthly_income,
    )
    db.add(user)
    await db.flush()
    logger.info(f"✅ New user created: {email}")
    return user


LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15

MSG_INVALID_CREDENTIALS = "이메일 또는 비밀번호가 일치하지 않습니다."
MSG_ACCOUNT_LOCKED = "비밀번호 5회 오류로 계정이 임시 잠금되었습니다. 15분 후 다시 시도하거나 비밀번호를 재설정하세요."


async def authenticate_user(db: AsyncSession, email: str, password: str):
    """
    Verify email + password with brute-force defense.
    Returns user on success, None on wrong credentials (401).
    Raises HTTPException 403 when account is locked.
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not user.is_active:
        return None

    now = datetime.now(timezone.utc)

    # 1. Check lockout (skip password verification if locked)
    if user.locked_until is not None and now < user.locked_until:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MSG_ACCOUNT_LOCKED,
        )

    # 2. Lock expired — reset before retry
    if user.locked_until is not None and now >= user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None

    # 3. Verify password
    if not verify_password(password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= LOCKOUT_THRESHOLD:
            from datetime import timedelta
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            logger.warning(f"Account locked: {user.email} after {user.failed_login_attempts} failed attempts")
        await db.commit()
        return None

    # 4. Success — reset lockout and update last login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    return user


async def delete_user_and_all_data(db: AsyncSession, user_id: str) -> None:
    """
    Cascade delete: removes all data linked to the user, then the user.
    Order: transactions (user + bank_conn) → bank_connections → budgets → goals → user.
    """
    from sqlalchemy import delete, or_, select
    from database.models import (
        BankConnectionRecord,
        BudgetRecord,
        GoalRecord,
        TransactionRecord,
        UserRecord,
    )

    # 1. Transactions: by user_id OR by bank_connection_id (user's connections)
    subq = select(BankConnectionRecord.id).where(BankConnectionRecord.user_id == user_id)
    await db.execute(
        delete(TransactionRecord).where(
            or_(
                TransactionRecord.user_id == user_id,
                TransactionRecord.bank_connection_id.in_(subq),
            )
        )
    )
    # 2. Bank connections
    await db.execute(delete(BankConnectionRecord).where(BankConnectionRecord.user_id == user_id))
    # 3. Budgets
    await db.execute(delete(BudgetRecord).where(BudgetRecord.user_id == user_id))
    # 4. Goals
    await db.execute(delete(GoalRecord).where(GoalRecord.user_id == user_id))
    # 5. User
    await db.execute(delete(UserRecord).where(UserRecord.id == user_id))
    logger.info(f"Deleted user and all associated data: {user_id[:8]}...")
