"""
Aura Finance — Finance Service (Phase 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

계좌 잔고, 최근 지출/수입 내역, 목표 진행률 계산.
실제 거래가 없을 때 Mock 데이터로 데모 제공.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import GoalRecord, TransactionRecord

logger = logging.getLogger(__name__)


# ── Mock transactions (데이터 없을 때 데모용) ──────────────────────────────────
# DB에 저장하지 않고 API 응답 시에만 반환

def _get_mock_transactions() -> list[dict[str, Any]]:
    """실제 거래가 없을 때 반환할 Mock 지출/수입 내역."""
    now = datetime.now(timezone.utc)
    base_ts = int(now.timestamp() * 1000)

    return [
        # Income
        {
            "id": "mock_income_1",
            "description": "Salary — Aura Corp",
            "amount": 4200.0,
            "currency": "USD",
            "tx_type": "income",
            "district": "Salary",
            "tx_timestamp": base_ts - 5 * 86400 * 1000,
            "source": "mock",
        },
        {
            "id": "mock_income_2",
            "description": "Freelance — Web Design",
            "amount": 580.0,
            "currency": "USD",
            "tx_type": "income",
            "district": "Freelance",
            "tx_timestamp": base_ts - 12 * 86400 * 1000,
            "source": "mock",
        },
        # Expenses
        {
            "id": "mock_exp_1",
            "description": "Wayne's Coffee",
            "amount": -12.50,
            "currency": "USD",
            "tx_type": "expense",
            "district": "Food & Cafe",
            "tx_timestamp": base_ts - 1 * 86400 * 1000,
            "source": "mock",
        },
        {
            "id": "mock_exp_2",
            "description": "Grocery — Whole Foods",
            "amount": -89.20,
            "currency": "USD",
            "tx_type": "expense",
            "district": "Food & Cafe",
            "tx_timestamp": base_ts - 2 * 86400 * 1000,
            "source": "mock",
        },
        {
            "id": "mock_exp_3",
            "description": "Netflix Subscription",
            "amount": -15.99,
            "currency": "USD",
            "tx_type": "expense",
            "district": "Entertainment",
            "tx_timestamp": base_ts - 3 * 86400 * 1000,
            "source": "mock",
        },
        {
            "id": "mock_exp_4",
            "description": "Uber — Transport",
            "amount": -28.00,
            "currency": "USD",
            "tx_type": "expense",
            "district": "Transport",
            "tx_timestamp": base_ts - 4 * 86400 * 1000,
            "source": "mock",
        },
        {
            "id": "mock_exp_5",
            "description": "Shopping — Electronics",
            "amount": -199.00,
            "currency": "USD",
            "tx_type": "expense",
            "district": "Shopping",
            "tx_timestamp": base_ts - 7 * 86400 * 1000,
            "source": "mock",
        },
    ]


def _tx_record_to_dict(r: TransactionRecord) -> dict[str, Any]:
    """ORM → API 응답용 dict 변환."""
    return {
        "id": r.id,
        "description": r.description,
        "amount": r.amount,
        "currency": r.currency or "USD",
        "tx_type": r.tx_type or "expense",
        "district": r.district or "Unknown",
        "tx_timestamp": int(r.tx_timestamp.timestamp() * 1000) if r.tx_timestamp else 0,
        "source": r.source or "manual",
    }


async def get_recent_transactions(
    db: AsyncSession,
    user_id: str,
    limit: int = 20,
    use_mock_if_empty: bool = True,
) -> list[dict[str, Any]]:
    """
    최근 지출/수입 내역. 실제 거래가 없으면 Mock 반환.
    """
    stmt = (
        select(TransactionRecord)
        .where(TransactionRecord.user_id == user_id)
        .order_by(TransactionRecord.tx_timestamp.desc().nullslast())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())

    if rows:
        result = [_tx_record_to_dict(r) for r in rows]
        # expense amount: DB might store as positive; we use signed for consistency
        return result

    if use_mock_if_empty:
        return _get_mock_transactions()
    return []


async def get_balance_from_transactions(db: AsyncSession, user_id: str) -> float:
    """
    transactions 테이블 기준 잔고.
    income 합계 - expense 절대값 합계.
    """
    income_stmt = select(func.coalesce(func.sum(TransactionRecord.amount), 0.0)).where(
        and_(TransactionRecord.user_id == user_id, TransactionRecord.tx_type == "income")
    )
    expense_stmt = select(
        func.coalesce(func.sum(func.abs(TransactionRecord.amount)), 0.0)
    ).where(
        and_(TransactionRecord.user_id == user_id, TransactionRecord.tx_type == "expense")
    )
    income  = float((await db.execute(income_stmt)).scalar_one() or 0)
    expense = float((await db.execute(expense_stmt)).scalar_one() or 0)
    return round(income - expense, 2)


async def get_finance_overview(
    db: AsyncSession,
    user_id: str,
) -> dict[str, Any]:
    """
    Phase 1 Overview: 잔고, 최근 거래, 목표별 진행률.
    goals의 _compute_progress를 사용.
    """
    from routes.goals import _compute_progress, _goal_to_dict

    balance = await get_balance_from_transactions(db, user_id)
    recent_tx = await get_recent_transactions(db, user_id, limit=30, use_mock_if_empty=True)

    # Mock 사용 시 잔고도 Mock 기준으로 재계산
    if recent_tx and any(t.get("source") == "mock" for t in recent_tx):
        mock_only = [t for t in recent_tx if t.get("source") == "mock"]
        if mock_only:
            income_sum  = sum(t["amount"] for t in mock_only if t.get("tx_type") == "income")
            expense_sum = sum(abs(t["amount"]) for t in mock_only if t.get("tx_type") == "expense")
            balance = round(income_sum - expense_sum, 2)

    # Goals with progress
    stmt = select(GoalRecord).where(
        and_(GoalRecord.user_id == user_id, GoalRecord.status != "archived")
    ).order_by(GoalRecord.created_at.desc())
    goals = list((await db.execute(stmt)).scalars().all())

    goals_with_progress = []
    for g in goals:
        try:
            progress = await _compute_progress(db, g, user_id)
            goals_with_progress.append(_goal_to_dict(g, progress))
        except Exception as exc:
            logger.warning("Goal progress calc failed for %s: %s", g.id, exc)
            goals_with_progress.append(_goal_to_dict(g, None))

    return {
        "balance": balance,
        "currency": "USD",
        "recent_transactions": recent_tx,
        "goals_with_progress": goals_with_progress,
        "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
    }
