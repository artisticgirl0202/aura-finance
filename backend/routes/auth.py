"""
Aura Finance — Authentication Routes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POST /api/v1/auth/register        — create account
POST /api/v1/auth/login          — get access + refresh token
POST /api/v1/auth/refresh        — get new access token from refresh token
GET  /api/v1/auth/me              — get current user profile (protected)
PUT  /api/v1/auth/me              — update profile (income, currency, display_name)
GET  /api/v1/auth/export-data    — export user data as JSON (protected)
POST /api/v1/auth/delete-account — permanently delete account (password required)
"""

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.crud import get_budgets, list_transactions
from database.models import BudgetRecord, GoalRecord, TransactionRecord
from services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    decode_token,
    delete_user_and_all_data,
    extract_password_for_hashing,
    get_current_user_id,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:          str   = Field(..., description="User email")
    password:       str   = Field(..., min_length=8, description="Min 8 characters")
    display_name:   str   = Field(..., min_length=2)
    currency:       str   = Field(default="USD")
    monthly_income: float = Field(default=0.0, ge=0)


class LoginRequest(BaseModel):
    email:    str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "Bearer"
    expires_in:    int = 1800   # 30 min in seconds
    user_id:       str
    email:         str
    display_name:  str


class UserProfile(BaseModel):
    id:             str
    email:          str
    display_name:   str
    currency:       str
    monthly_income: float
    tink_user_id:   Optional[str]
    created_at:     str
    last_login_at:  Optional[str]


class UpdateProfileRequest(BaseModel):
    display_name:   Optional[str]  = None
    currency:       Optional[str]  = None
    monthly_income: Optional[float] = None


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, description="Current password for verification")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="User email for password reset")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, description="One-time reset token from email")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create a new Aura Finance account.
    Returns tokens immediately — no separate login step required.
    """
    try:
        # Extract password as plain str (handles SecretStr); never pass model/dict
        password_str = extract_password_for_hashing(payload.password)
        user = await create_user(
            db,
            email=payload.email,
            display_name=payload.display_name,
            password=password_str,
            currency=payload.currency,
            monthly_income=payload.monthly_income,
        )
        await db.commit()
        logger.info(f"New user registered: {payload.email}")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except TypeError as exc:
        logger.warning("Register password type error: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid password format.")

    return TokenResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login with email + password. Returns access + refresh tokens.
    """
    user = await authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 일치하지 않습니다.",
        )
    await db.commit()   # persist last_login_at update

    return TokenResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """
    Use a refresh token to get a new access token without re-entering password.
    """
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await get_user_by_id(db, decoded["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),   # rotate refresh token
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserProfile)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the currently authenticated user's profile."""
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfile(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        currency=user.currency,
        monthly_income=user.monthly_income,
        tink_user_id=user.tink_user_id,
        created_at=user.created_at.isoformat(),
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


@router.put("/me", response_model=UserProfile)
async def update_me(
    payload: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update profile fields (income, currency, display name)."""
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.currency is not None:
        user.currency = payload.currency
    if payload.monthly_income is not None:
        user.monthly_income = payload.monthly_income
    user.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return UserProfile(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        currency=user.currency,
        monthly_income=user.monthly_income,
        tink_user_id=user.tink_user_id,
        created_at=user.created_at.isoformat(),
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


MSG_FORGOT_SUCCESS = "해당 이메일이 존재한다면 재설정 링크가 발송되었습니다."
MSG_RESET_INVALID = "만료되거나 유효하지 않은 링크입니다."
RESET_TOKEN_EXPIRE_MINUTES = 15


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Request password reset. User enumeration 방지: 존재 여부와 무관하게 200 응답.
    메일 발송 실패(SMTP 네트워크 오류 등) 시 500 반환 — 타임아웃 10초로 무한 대기 방지.
    """
    user = await get_user_by_email(db, payload.email.lower().strip())
    if user:
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        user.reset_token = token
        user.reset_token_expires = expires
        await db.flush()
        await db.commit()
        logger.info(
            "[forgot-password] Token saved for %s | expires=%s (UTC)",
            user.email,
            expires.isoformat(),
        )

        try:
            from services.email_service import send_password_reset_email
            await send_password_reset_email(user.email, token)
            logger.info("Password reset email sent to %s", user.email)
        except Exception as exc:
            logger.error(
                "Failed to send password reset email to %s: %s",
                user.email,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Password reset email could not be sent. Please try again later.",
            ) from exc
    return {"message": MSG_FORGOT_SUCCESS}


def _ensure_utc(dt: datetime | None) -> datetime | None:
    """
    SQLite 등에서 timezone-naive datetime이 반환될 수 있음.
    naive → UTC로 간주하여 timezone-aware로 변환.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Reset password using one-time token. Invalid/expired token → 400.
    On success: clear lockout fields and invalidate token.
    JSON body: { "token": "...", "new_password": "..." }
    """
    try:
        from sqlalchemy import select
        from database.models import UserRecord

        token = (payload.token or "").strip()
        logger.info("[reset-password] Received token (len=%d): %s...", len(token), token[:12] + "..." if len(token) > 12 else token)

        if not token:
            logger.info("[reset-password] Token empty → 400")
            raise HTTPException(status_code=400, detail=MSG_RESET_INVALID)

        stmt = select(UserRecord).where(
            UserRecord.reset_token == token,
            UserRecord.reset_token_expires.isnot(None),
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        logger.info("[reset-password] User found: %s", user is not None)

        if not user:
            logger.info("[reset-password] No user with token → 400")
            raise HTTPException(status_code=400, detail=MSG_RESET_INVALID)

        now = datetime.now(timezone.utc)
        expires = _ensure_utc(user.reset_token_expires)
        is_expired = expires is None or now >= expires

        logger.info(
            "[reset-password] now=%s | expires=%s | is_expired=%s",
            now.isoformat(),
            expires.isoformat() if expires else "None",
            is_expired,
        )

        if expires is None or is_expired:
            logger.info("[reset-password] Token expired or invalid expires → 400")
            raise HTTPException(status_code=400, detail=MSG_RESET_INVALID)

        user.password_hash = hash_password(payload.new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.reset_token = None
        user.reset_token_expires = None
        await db.commit()
        logger.info("Password reset completed for user %s", user.email)
        return {"message": "비밀번호가 성공적으로 변경되었습니다."}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Reset password failed: %s", exc)
        raise HTTPException(status_code=400, detail=MSG_RESET_INVALID)


@router.get("/export-data")
async def export_data(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Export the current user's data as a JSON file.
    Includes: profile, transactions, goals, budgets.
    Requires authentication. Guests get 401 (frontend falls back to local data).
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Profile (exclude sensitive fields)
    profile = {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "currency": user.currency,
        "monthly_income": user.monthly_income,
        "created_at": user.created_at.isoformat(),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }

    # Transactions
    tx_records, _ = await list_transactions(
        db, user_id=user_id, limit=10_000, offset=0, order_by="desc"
    )
    transactions = [
        {
            "id": r.id,
            "description": r.description,
            "amount": float(r.amount),
            "currency": r.currency,
            "type": r.tx_type,
            "district": r.district,
            "confidence": r.confidence,
            "reason": r.reason,
            "icon": r.icon,
            "color": r.color,
            "source": r.source,
            "tx_timestamp": r.tx_timestamp.isoformat() if r.tx_timestamp else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in tx_records
    ]

    # Goals
    goal_stmt = select(GoalRecord).where(GoalRecord.user_id == user_id).order_by(GoalRecord.created_at.desc())
    goal_rows = (await db.execute(goal_stmt)).scalars().all()
    goals = [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "goal_type": g.goal_type,
            "target_amount": float(g.target_amount),
            "district": g.district,
            "period_type": g.period_type,
            "period_month": g.period_month,
            "target_date": str(g.target_date) if g.target_date else None,
            "icon": g.icon,
            "color": g.color,
            "status": g.status,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in goal_rows
    ]

    # Budgets
    budget_records = await get_budgets(db, user_id=user_id, period_month=None)
    budgets = [
        {
            "district": b.district,
            "budget_type": b.budget_type,
            "monthly_limit": float(b.monthly_limit),
            "period_month": b.period_month,
        }
        for b in budget_records
    ]

    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
        "transactions": transactions,
        "goals": goals,
        "budgets": budgets,
    }

    filename = f"aura_finance_export_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
    json_str = json.dumps(payload, indent=2, ensure_ascii=False)

    return Response(
        content=json_str.encode("utf-8"),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/delete-account")
async def delete_account(
    payload: DeleteAccountRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the account and all associated data.
    Requires password verification. Cascade deletes:
    transactions, bank_connections, budgets, goals, then the user.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid password. Account deletion aborted.",
        )

    await delete_user_and_all_data(db, user_id)
    await db.commit()
    logger.info(f"Account deleted: {user.email}")
    return {"message": "Account deleted successfully"}
