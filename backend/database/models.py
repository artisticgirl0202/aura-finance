"""
Aura Finance — SQLAlchemy ORM Models
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Table design principles:
  • UUID primary keys  → distributed-safe, no sequential ID leak
  • created_at / updated_at auto-managed by DB
  • Composite indexes  → optimised for time-series analytics queries
  • Nullable fields    → tolerant ingestion from multiple sources
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 1: transactions
# ─────────────────────────────────────────────────────────────────────────────

class TransactionRecord(Base):
    """
    Persists every classified financial transaction.

    Sources:
      tink       — real bank transactions via Tink Open Banking
      simulation — WebSocket simulation mode
      manual     — user-entered via UI

    AI fields:
      district, confidence, reason, icon, color  — classification output
      ai_engine                                  — which engine classified
      anomaly_score / is_anomaly                 — Module 2 output
    """
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ── Core financial fields ─────────────────────────────────────────────────
    description:  Mapped[str]           = mapped_column(String(512), nullable=False)
    amount:       Mapped[float]         = mapped_column(Float, nullable=False)
    currency:     Mapped[str]           = mapped_column(String(10), default="USD")
    tx_type:      Mapped[str]           = mapped_column(String(20), default="expense")
    # tx_type: "expense" | "income" | "investment"

    # ── AI classification output ──────────────────────────────────────────────
    district:     Mapped[str]           = mapped_column(String(64), default="Unknown")
    confidence:   Mapped[float]         = mapped_column(Float, default=0.0)
    reason:       Mapped[str | None]    = mapped_column(Text, nullable=True)
    icon:         Mapped[str | None]    = mapped_column(String(64), nullable=True)
    color:        Mapped[str | None]    = mapped_column(String(16), nullable=True)
    ai_engine:    Mapped[str | None]    = mapped_column(String(32), nullable=True)
    # ai_engine: "gemini" | "mock" | "openai" | "cache"

    # ── Anomaly / fraud detection (Module 2) ─────────────────────────────────
    anomaly_score:  Mapped[float | None]   = mapped_column(Float, nullable=True)
    is_anomaly:     Mapped[bool]           = mapped_column(Boolean, default=False)
    anomaly_type:   Mapped[str | None]     = mapped_column(String(64), nullable=True)

    # ── Source & linking ──────────────────────────────────────────────────────
    source:                Mapped[str]            = mapped_column(String(32), default="manual")
    tink_transaction_id:   Mapped[str | None]     = mapped_column(String(128), nullable=True, unique=True)
    user_id:               Mapped[str | None]     = mapped_column(String(128), nullable=True)
    bank_connection_id:    Mapped[str | None]     = mapped_column(String(36), nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    # tx_timestamp: when the transaction actually occurred (from bank / simulation)
    tx_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # created_at: when we stored it in our DB
    created_at:   Mapped[datetime]        = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at:   Mapped[datetime]        = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Indexes for analytics queries ─────────────────────────────────────────
    __table_args__ = (
        Index("ix_tx_district",        "district"),
        Index("ix_tx_type",            "tx_type"),
        Index("ix_tx_source",          "source"),
        Index("ix_tx_user",            "user_id"),
        Index("ix_tx_bank_conn",       "bank_connection_id"),
        Index("ix_tx_ts",              "tx_timestamp"),
        Index("ix_tx_created",         "created_at"),
        Index("ix_tx_district_ts",     "district", "tx_timestamp"),
        Index("ix_tx_user_type",       "user_id",  "tx_type"),
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction id={self.id[:8]} "
            f"'{self.description[:30]}' "
            f"{self.amount} {self.currency} → {self.district}>"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 2: budgets
# ─────────────────────────────────────────────────────────────────────────────

class BudgetRecord(Base):
    """
    Per-user, per-category monthly budget limits and goals.
    Persists what the user sets in the BudgetPanel UI.
    """
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id:        Mapped[str]         = mapped_column(String(128), nullable=False, default="default")
    district:       Mapped[str]         = mapped_column(String(64),  nullable=False)
    budget_type:    Mapped[str]         = mapped_column(String(20),  default="expense")
    # budget_type: "expense" | "income_goal" | "investment_goal"

    monthly_limit:  Mapped[float]       = mapped_column(Float, nullable=False)
    period_month:   Mapped[str]         = mapped_column(String(7), nullable=False)
    # period_month: "YYYY-MM"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "district", "budget_type", "period_month",
                         name="uq_budget_user_district_type_month"),
        Index("ix_budget_user_month", "user_id", "period_month"),
    )

    def __repr__(self) -> str:
        return (
            f"<Budget user={self.user_id} "
            f"{self.district} {self.budget_type} "
            f"${self.monthly_limit} [{self.period_month}]>"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 3: ai_analysis_cache
# Persists Gemini/Mock AI classification cache across server restarts
# ─────────────────────────────────────────────────────────────────────────────

class AnalysisCacheRecord(Base):
    """
    Persistent AI classification cache.
    Replaces the in-memory dict in ai_classifier.py — survives server restarts,
    dramatically reducing repeated Gemini API calls.
    """
    __tablename__ = "ai_analysis_cache"

    cache_key:  Mapped[str]  = mapped_column(String(64),  primary_key=True)
    district:   Mapped[str]  = mapped_column(String(64),  nullable=False)
    confidence: Mapped[float] = mapped_column(Float,      nullable=False)
    reason:     Mapped[str]  = mapped_column(Text,        nullable=False)
    icon:       Mapped[str]  = mapped_column(String(64),  nullable=False)
    color:      Mapped[str]  = mapped_column(String(16),  nullable=False)
    ai_engine:  Mapped[str]  = mapped_column(String(32),  nullable=False, default="mock")
    hit_count:  Mapped[int]  = mapped_column(Integer,     default=1)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_hit_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Cache key={self.cache_key[:12]} → {self.district} [{self.ai_engine}]>"


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 4: users  (JWT auth)
# ─────────────────────────────────────────────────────────────────────────────

class UserRecord(Base):
    """
    Internal Aura Finance users.
    Separate from Tink users — one Aura user can link multiple Tink accounts.
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email:         Mapped[str]          = mapped_column(String(255), unique=True, nullable=False)
    display_name:  Mapped[str]          = mapped_column(String(128), nullable=False)
    password_hash: Mapped[str]          = mapped_column(String(255), nullable=False)
    is_active:     Mapped[bool]         = mapped_column(Boolean, default=True)

    # Linked Tink user (Sandbox or Production)
    tink_user_id:  Mapped[str | None]   = mapped_column(String(128), nullable=True)
    tink_scope:    Mapped[str | None]   = mapped_column(String(512), nullable=True)

    # Brute-force defense (계정 잠금)
    failed_login_attempts: Mapped[int]           = mapped_column(Integer, default=0)
    locked_until:          Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Password reset (일회성 보안 토큰)
    reset_token:           Mapped[str | None]     = mapped_column(String(64), nullable=True)
    reset_token_expires:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Preferences
    currency:      Mapped[str]          = mapped_column(String(8),   default="USD")
    monthly_income: Mapped[float]       = mapped_column(Float,       default=0.0)

    created_at:    Mapped[datetime]     = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at:    Mapped[datetime]     = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_user_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.id[:8]})>"


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 5: bank_connections  (은행 계좌 연결)
# ─────────────────────────────────────────────────────────────────────────────

class BankConnectionRecord(Base):
    """
    은행 계좌 연결 정보.
    OAuth로 획득한 access_token을 사용자와 연결하여 저장.
    """
    __tablename__ = "bank_connections"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id:        Mapped[str]          = mapped_column(String(36), nullable=False, default="default")
    bank_name:      Mapped[str]          = mapped_column(String(128), default="Tink Demo")
    # Note: Production에서는 access_token을 암호화 저장 (Fernet 등)
    access_token:   Mapped[str]          = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None]    = mapped_column(Text, nullable=True)
    tink_user_id:  Mapped[str | None]    = mapped_column(String(128), nullable=True)
    status:        Mapped[str]          = mapped_column(String(16), default="active")
    # status: "active" | "revoked" | "expired"
    connected_at:  Mapped[datetime]      = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_bank_conn_user", "user_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Core Table 6: goals  (financial goal tracking)
# ─────────────────────────────────────────────────────────────────────────────

class GoalRecord(Base):
    """
    Financial goals set by the user.

    goal_type:
      expense_limit  — keep spending below target (e.g. Food & Cafe < $200/mo)
      savings        — accumulate target amount (income − expense >= target)
      income_target  — reach an income milestone (salary + side-income >= target)
      investment     — invest target amount (sum of investment transactions)
      net_worth      — total assets minus liabilities goal

    period_type:
      monthly   — resets every calendar month
      annual    — resets every year
      one_time  — single target by target_date (no reset)

    status lifecycle:
      active → achieved (auto by progress calc) | failed | paused | archived
    """
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    user_id:       Mapped[str]          = mapped_column(String(36),  nullable=False, default="default")
    name:          Mapped[str]          = mapped_column(String(256), nullable=False)
    description:   Mapped[str | None]   = mapped_column(Text,        nullable=True)
    goal_type:     Mapped[str]          = mapped_column(String(32),  nullable=False)
    # goal_type: "expense_limit" | "savings" | "income_target" | "investment" | "net_worth"

    # Target definition
    target_amount: Mapped[float]        = mapped_column(Float,  nullable=False)
    district:      Mapped[str | None]   = mapped_column(String(64), nullable=True)
    # district: which city district this goal applies to (null = all)

    # Period
    period_type:   Mapped[str]          = mapped_column(String(16), default="monthly")
    period_month:  Mapped[str | None]   = mapped_column(String(7),  nullable=True)
    # period_month: "YYYY-MM" for monthly goals
    target_date:   Mapped[date | None]  = mapped_column(Date, nullable=True)
    # target_date: deadline for one_time goals

    # Visual (maps to 3D city colors)
    icon:          Mapped[str]          = mapped_column(String(64), default="target")
    color:         Mapped[str]          = mapped_column(String(16), default="#10b981")

    # Status
    status:        Mapped[str]          = mapped_column(String(16), default="active")
    # status: "active" | "achieved" | "failed" | "paused" | "archived"

    # Cached progress (updated by background job or on-demand)
    cached_progress_pct: Mapped[float]  = mapped_column(Float, default=0.0)
    cached_current_amt:  Mapped[float]  = mapped_column(Float, default=0.0)

    created_at:    Mapped[datetime]     = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at:    Mapped[datetime]     = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_goal_user",        "user_id"),
        Index("ix_goal_user_status", "user_id", "status"),
        Index("ix_goal_type",        "goal_type"),
    )

    def __repr__(self) -> str:
        return (
            f"<Goal '{self.name}' {self.goal_type} "
            f"${self.target_amount} [{self.status}]>"
        )
