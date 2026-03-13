"""
Aura Finance — CRUD Operations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All functions are async and accept an AsyncSession.
Pattern:
  create_*  → insert row, return the ORM object
  get_*     → query + return (None if not found)
  list_*    → paginated list with filters
  upsert_*  → insert or update on conflict
  stats_*   → aggregation / analytics queries
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AnalysisCacheRecord, BankConnectionRecord, BudgetRecord, TransactionRecord

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Transactions — create
# ─────────────────────────────────────────────────────────────────────────────

async def create_transaction(
    db: AsyncSession,
    *,
    description: str,
    amount: float,
    currency: str = "USD",
    tx_type: str = "expense",
    district: str = "Unknown",
    confidence: float = 0.0,
    reason: Optional[str] = None,
    icon: Optional[str] = None,
    color: Optional[str] = None,
    ai_engine: Optional[str] = None,
    source: str = "manual",
    tink_transaction_id: Optional[str] = None,
    user_id: Optional[str] = None,
    bank_connection_id: Optional[str] = None,
    tx_timestamp: Optional[datetime] = None,
    anomaly_score: Optional[float] = None,
    is_anomaly: bool = False,
    anomaly_type: Optional[str] = None,
) -> TransactionRecord:
    """Insert a new transaction and return the persisted record."""
    record = TransactionRecord(
        id=str(uuid.uuid4()),
        description=description,
        amount=amount,
        currency=currency,
        tx_type=tx_type,
        district=district,
        confidence=confidence,
        reason=reason,
        icon=icon,
        color=color,
        ai_engine=ai_engine,
        source=source,
        tink_transaction_id=tink_transaction_id,
        user_id=user_id,
        bank_connection_id=bank_connection_id,
        tx_timestamp=tx_timestamp or datetime.now(timezone.utc),
        anomaly_score=anomaly_score,
        is_anomaly=is_anomaly,
        anomaly_type=anomaly_type,
    )
    db.add(record)
    await db.flush()   # assigns id without committing (commit in get_db)
    logger.debug(f"📝 Saved tx '{description[:30]}' → {district} [{source}]")
    return record


async def create_transactions_bulk(
    db: AsyncSession,
    records: list[dict],
) -> list[TransactionRecord]:
    """Bulk insert transactions (more efficient than N create_transaction calls)."""
    objs = [TransactionRecord(id=str(uuid.uuid4()), **r) for r in records]
    db.add_all(objs)
    await db.flush()
    logger.info(f"📦 Bulk saved {len(objs)} transactions")
    return objs


# ─────────────────────────────────────────────────────────────────────────────
# Transactions — read
# ─────────────────────────────────────────────────────────────────────────────

async def get_transaction(db: AsyncSession, tx_id: str) -> Optional[TransactionRecord]:
    result = await db.get(TransactionRecord, tx_id)
    return result


async def get_transaction_by_tink_id(
    db: AsyncSession, tink_id: str
) -> Optional[TransactionRecord]:
    stmt = select(TransactionRecord).where(TransactionRecord.tink_transaction_id == tink_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_transactions(
    db: AsyncSession,
    *,
    user_id: Optional[str] = None,
    tx_type: Optional[str] = None,
    district: Optional[str] = None,
    source: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    order_by: str = "desc",   # "desc" | "asc" (by tx_timestamp)
) -> tuple[list[TransactionRecord], int]:
    """
    Paginated transaction list with filters.
    Returns (records, total_count).
    """
    filters = []
    if user_id:
        filters.append(TransactionRecord.user_id == user_id)
    if tx_type:
        filters.append(TransactionRecord.tx_type == tx_type)
    if district:
        filters.append(TransactionRecord.district == district)
    if source:
        filters.append(TransactionRecord.source == source)
    if is_anomaly is not None:
        filters.append(TransactionRecord.is_anomaly == is_anomaly)
    if search:
        filters.append(TransactionRecord.description.ilike(f"%{search}%"))

    where = and_(*filters) if filters else True

    # Count
    count_stmt = select(func.count()).select_from(TransactionRecord).where(where)
    total = (await db.execute(count_stmt)).scalar_one()

    # Data
    order = (
        desc(TransactionRecord.tx_timestamp)
        if order_by == "desc"
        else TransactionRecord.tx_timestamp
    )
    data_stmt = (
        select(TransactionRecord)
        .where(where)
        .order_by(order)
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(data_stmt)).scalars().all()
    return list(rows), total


async def find_manual_classification_match(
    db: AsyncSession,
    *,
    description: str,
    user_id: Optional[str] = None,
) -> Optional[dict]:
    """
    사용자 과거 수동 분류 기록에서 동일/유사 상호명 매칭.
    AI 호출 전 Override용 — 매칭 시 해당 district/confidence/reason/icon/color 반환.
    """
    if not description or not description.strip():
        return None

    norm = description.strip().lower()
    if len(norm) < 2:
        return None

    filters = [TransactionRecord.source == "manual"]
    if user_id and user_id != "guest":
        filters.append(TransactionRecord.user_id == user_id)

    stmt = (
        select(TransactionRecord)
        .where(and_(*filters))
        .order_by(desc(TransactionRecord.tx_timestamp))
        .limit(50)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    for r in rows:
        old_norm = (r.description or "").strip().lower()
        if not old_norm:
            continue
        # 1) Exact match
        if old_norm == norm:
            return {
                "district": r.district,
                "confidence": float(r.confidence or 0.9),
                "reason": r.reason or "User manual override (exact)",
                "icon": r.icon or "circle",
                "color": r.color or "#6b7280",
            }
        # 2) Substring: shorter contained in longer
        short, long = (old_norm, norm) if len(old_norm) < len(norm) else (norm, old_norm)
        if len(short) >= 3 and short in long:
            return {
                "district": r.district,
                "confidence": min(0.95, float(r.confidence or 0.9) + 0.05),
                "reason": r.reason or "User manual override (similar)",
                "icon": r.icon or "circle",
                "color": r.color or "#6b7280",
            }
    return None


async def get_manual_classification_examples(
    db: AsyncSession,
    *,
    user_id: Optional[str] = None,
    limit: int = 5,
) -> list[dict]:
    """
    사용자 최근 수동 분류 기록을 Few-shot 예제로 반환.
    AI 프롬프트 Context용.
    """
    filters = [TransactionRecord.source == "manual"]
    if user_id and user_id != "guest":
        filters.append(TransactionRecord.user_id == user_id)

    stmt = (
        select(TransactionRecord)
        .where(and_(*filters))
        .order_by(desc(TransactionRecord.tx_timestamp))
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "description": r.description,
            "district": r.district,
            "reason": r.reason or "",
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Transactions — analytics / aggregation
# ─────────────────────────────────────────────────────────────────────────────

async def stats_by_district(
    db: AsyncSession,
    *,
    user_id: Optional[str] = None,
    tx_type: str = "expense",
    limit: int = 20,
) -> list[dict]:
    """
    Spending total + count per district.
    Ready for pie chart, bar chart, and portfolio analysis.
    """
    filters = [TransactionRecord.tx_type == tx_type]
    if user_id:
        filters.append(TransactionRecord.user_id == user_id)

    stmt = (
        select(
            TransactionRecord.district,
            func.sum(TransactionRecord.amount).label("total"),
            func.count(TransactionRecord.id).label("count"),
            func.avg(TransactionRecord.amount).label("avg_amount"),
            func.max(TransactionRecord.tx_timestamp).label("last_tx"),
        )
        .where(and_(*filters))
        .group_by(TransactionRecord.district)
        .order_by(desc("total"))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "district": r.district,
            "total": round(float(r.total), 2),
            "count": r.count,
            "avg_amount": round(float(r.avg_amount), 2),
            "last_tx": r.last_tx.isoformat() if r.last_tx else None,
        }
        for r in rows
    ]


async def stats_time_series(
    db: AsyncSession,
    *,
    user_id: Optional[str] = None,
    district: Optional[str] = None,
    days: int = 30,
) -> list[dict]:
    """
    Daily spending totals for time-series charts / trend prediction feed.
    SQLite-compatible date truncation.
    """
    from datetime import timedelta
    from sqlalchemy import cast, Date

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    filters = [
        TransactionRecord.tx_type == "expense",
        TransactionRecord.tx_timestamp >= cutoff,
    ]
    if user_id:
        filters.append(TransactionRecord.user_id == user_id)
    if district:
        filters.append(TransactionRecord.district == district)

    stmt = (
        select(
            cast(TransactionRecord.tx_timestamp, Date).label("day"),
            TransactionRecord.district,
            func.sum(TransactionRecord.amount).label("total"),
            func.count(TransactionRecord.id).label("count"),
        )
        .where(and_(*filters))
        .group_by("day", TransactionRecord.district)
        .order_by("day")
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "day": str(r.day),
            "district": r.district,
            "total": round(float(r.total), 2),
            "count": r.count,
        }
        for r in rows
    ]


async def stats_anomaly_summary(
    db: AsyncSession,
    *,
    user_id: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """Return the most recent anomalous transactions."""
    filters = [TransactionRecord.is_anomaly == True]
    if user_id:
        filters.append(TransactionRecord.user_id == user_id)

    stmt = (
        select(TransactionRecord)
        .where(and_(*filters))
        .order_by(desc(TransactionRecord.anomaly_score))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_tx_to_dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Bank Connections
# ─────────────────────────────────────────────────────────────────────────────

async def create_bank_connection(
    db: AsyncSession,
    *,
    user_id: str,
    access_token: str,
    refresh_token: Optional[str] = None,
    tink_user_id: Optional[str] = None,
    bank_name: str = "Tink Demo",
) -> BankConnectionRecord:
    """Store bank connection for a user."""
    record = BankConnectionRecord(
        user_id=user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        tink_user_id=tink_user_id,
        bank_name=bank_name,
        status="active",
    )
    db.add(record)
    await db.flush()
    return record


async def get_active_bank_connection(
    db: AsyncSession, user_id: str
) -> Optional[BankConnectionRecord]:
    """Get the most recent active bank connection for a user."""
    stmt = (
        select(BankConnectionRecord)
        .where(
            and_(
                BankConnectionRecord.user_id == user_id,
                BankConnectionRecord.status == "active",
            )
        )
        .order_by(desc(BankConnectionRecord.connected_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def revoke_bank_connections_for_user(db: AsyncSession, user_id: str) -> int:
    """Revoke all active bank connections for a user (status → revoked). Returns count."""
    stmt = (
        update(BankConnectionRecord)
        .where(
            and_(
                BankConnectionRecord.user_id == user_id,
                BankConnectionRecord.status == "active",
            )
        )
        .values(status="revoked")
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


# ─────────────────────────────────────────────────────────────────────────────
# Budgets
# ─────────────────────────────────────────────────────────────────────────────

async def upsert_budget(
    db: AsyncSession,
    *,
    user_id: str = "default",
    district: str,
    budget_type: str = "expense",
    monthly_limit: float,
    period_month: str,   # "YYYY-MM"
) -> BudgetRecord:
    """Insert or update a budget limit."""
    # Try to find existing
    stmt = select(BudgetRecord).where(
        and_(
            BudgetRecord.user_id == user_id,
            BudgetRecord.district == district,
            BudgetRecord.budget_type == budget_type,
            BudgetRecord.period_month == period_month,
        )
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()

    if existing:
        existing.monthly_limit = monthly_limit
        existing.updated_at = datetime.now(timezone.utc)
        return existing
    else:
        record = BudgetRecord(
            user_id=user_id,
            district=district,
            budget_type=budget_type,
            monthly_limit=monthly_limit,
            period_month=period_month,
        )
        db.add(record)
        await db.flush()
        return record


async def get_budgets(
    db: AsyncSession,
    user_id: str = "default",
    period_month: Optional[str] = None,
) -> list[BudgetRecord]:
    """Get all budget records for a user (optionally filtered by month)."""
    filters = [BudgetRecord.user_id == user_id]
    if period_month:
        filters.append(BudgetRecord.period_month == period_month)
    stmt = select(BudgetRecord).where(and_(*filters)).order_by(BudgetRecord.district)
    return list((await db.execute(stmt)).scalars().all())


# ─────────────────────────────────────────────────────────────────────────────
# AI Classification Cache — persistent
# ─────────────────────────────────────────────────────────────────────────────

async def cache_get(db: AsyncSession, key: str) -> Optional[dict]:
    """Read a cached classification from the persistent DB cache."""
    record = await db.get(AnalysisCacheRecord, key)
    if record is None:
        return None
    # Update hit stats (fire-and-forget — don't block)
    record.hit_count += 1
    record.last_hit_at = datetime.now(timezone.utc)
    return {
        "district": record.district,
        "confidence": record.confidence,
        "reason": record.reason,
        "icon": record.icon,
        "color": record.color,
        "ai_engine": record.ai_engine,
    }


async def cache_set(
    db: AsyncSession,
    key: str,
    *,
    district: str,
    confidence: float,
    reason: str,
    icon: str,
    color: str,
    ai_engine: str = "mock",
) -> None:
    """Write or update a classification in the persistent DB cache."""
    existing = await db.get(AnalysisCacheRecord, key)
    if existing:
        existing.district    = district
        existing.confidence  = confidence
        existing.reason      = reason
        existing.icon        = icon
        existing.color       = color
        existing.ai_engine   = ai_engine
        existing.last_hit_at = datetime.now(timezone.utc)
    else:
        db.add(AnalysisCacheRecord(
            cache_key=key,
            district=district,
            confidence=confidence,
            reason=reason,
            icon=icon,
            color=color,
            ai_engine=ai_engine,
        ))


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _tx_to_dict(r: TransactionRecord) -> dict:
    return {
        "id":            r.id,
        "description":   r.description,
        "amount":        r.amount,
        "currency":      r.currency,
        "type":          r.tx_type,
        "district":      r.district,
        "confidence":    r.confidence,
        "reason":        r.reason,
        "icon":          r.icon,
        "color":         r.color,
        "ai_engine":     r.ai_engine,
        "source":        r.source,
        "is_anomaly":    r.is_anomaly,
        "anomaly_score": r.anomaly_score,
        "anomaly_type":  r.anomaly_type,
        "tx_timestamp":  r.tx_timestamp.isoformat() if r.tx_timestamp else None,
        "created_at":    r.created_at.isoformat() if r.created_at else None,
    }
