"""
Aura Finance — Analytics API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Endpoints:
  GET /api/v1/analytics/overview     — Budget vs actual, M4 trend risk, M6 advice
  GET /api/v1/analytics/insights     — Phase 3: AI smart alerts (경고/칭찬)
  GET /api/v1/analytics/goals/{id}/forecast — Goal-specific RAG advice + SHAP
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select  # noqa: F401
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.crud import get_budgets, list_transactions
from database.models import GoalRecord, TransactionRecord
from services.analytics_service import get_analytics_overview, get_goal_forecast
from services.auth_service import get_optional_user_id
from services.finance_service import get_finance_overview
from services.guest_mock_data import get_guest_analytics_overview, get_guest_insights
from services.insights_service import generate_insights, insights_to_dicts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


async def _get_user_transactions(db: AsyncSession, user_id: str, limit: int = 200):
    records, _ = await list_transactions(
        db, user_id=user_id, limit=limit, order_by="desc"
    )
    return records


async def _get_budget_limits(db: AsyncSession, user_id: str) -> dict[str, float]:
    now = datetime.now(timezone.utc)
    period = now.strftime("%Y-%m")
    budgets = await get_budgets(db, user_id=user_id, period_month=period)
    return {b.district: float(b.monthly_limit) for b in budgets if b.budget_type == "expense" and b.monthly_limit > 0}


async def _get_income_total(db: AsyncSession, user_id: str) -> float:
    from sqlalchemy import select, func, and_
    stmt = select(func.coalesce(func.sum(TransactionRecord.amount), 0.0)).where(
        and_(
            TransactionRecord.user_id == user_id,
            TransactionRecord.tx_type == "income",
        )
    )
    result = await db.execute(stmt)
    return float(result.scalar_one() or 0)


def _empty_analytics_overview() -> dict:
    """Empty but complete structure — no 500, chart-ready defaults."""
    return {
        "categories": [],
        "ai_advice": [],
        "risk_score": 20.0,
        "income_total": 0.0,
        "expense_total": 0.0,
        "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
        # Phase 2 chart-ready
        "spending_distribution": [],
        "month_over_month": {
            "this_month_expense": 0.0,
            "last_month_expense": 0.0,
            "change_pct": 0.0,
            "change_direction": "stable",
            "this_month_income": 0.0,
            "last_month_income": 0.0,
        },
        "volatility": {
            "std_dev": 0.0,
            "mean": 0.0,
            "coefficient_of_variation": 0.0,
            "volatility_level": "low",
            "months_analyzed": 0,
        },
        "monthly_trend": [],
        "portfolio_score": None,
        "savings_rate": None,
    }


@router.get("/overview")
async def analytics_overview(
    user_id: str = Depends(get_optional_user_id),
    limit: int = Query(500, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """
    Budget vs actual, category spend rates, M4/M6 AI, Phase 2 chart-ready stats.
    Returns full structure even when data is empty (no 500).
    게스트 모드: 풍부한 Mock 데이터 반환.
    """
    try:
        if user_id == "guest":
            return get_guest_analytics_overview()
        uid = user_id or "default"
        records = await _get_user_transactions(db, uid, limit)
        if not records:
            return _empty_analytics_overview()

        budget_limits = await _get_budget_limits(db, uid)
        income_total = await _get_income_total(db, uid)
        result = await get_analytics_overview(records, budget_limits, income_total)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analytics overview failed: %s", e)
        return _empty_analytics_overview()  # Graceful fallback instead of 500


@router.get("/insights")
async def analytics_insights(
    user_id: str = Depends(get_optional_user_id),
    limit: int = Query(500, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 3: AI Smart Alerts — 잔고, 지출, 목표 진행률 기반 경고/칭찬 메시지.
    Toast 알림창에 표시할 인사이트 목록 반환.
    게스트 모드: Mock 인사이트 반환.
    """
    try:
        if user_id == "guest":
            return {
                "insights": get_guest_insights(),
                "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
            }
        uid = user_id or "default"
        overview = await get_finance_overview(db, uid)
        balance = overview["balance"]
        goals_with_progress = overview.get("goals_with_progress", [])

        # This month income/expense from overview's recent_tx or aggregate
        records, _ = await list_transactions(db, user_id=uid, limit=limit, order_by="desc")
        now = datetime.now(timezone.utc)
        this_key = now.strftime("%Y-%m")

        this_month_income = 0.0
        this_month_expense = 0.0
        category_spent: dict[str, float] = defaultdict(float)

        for r in records:
            if not r.tx_timestamp:
                continue
            key = r.tx_timestamp.strftime("%Y-%m")
            if key != this_key:
                continue
            amt = abs(float(r.amount or 0))
            if (r.tx_type or "expense") == "expense":
                this_month_expense += amt
                category_spent[r.district or "Unknown"] += amt
            else:
                this_month_income += float(r.amount or 0)

        budget_limits = await _get_budget_limits(db, uid)
        insights = generate_insights(
            balance=balance,
            this_month_income=this_month_income,
            this_month_expense=this_month_expense,
            goals_with_progress=goals_with_progress,
            budget_limits=budget_limits,
            category_spent=dict(category_spent),
        )
        return {
            "insights": insights_to_dicts(insights),
            "updated_at": now.isoformat() + "Z",
        }
    except Exception as e:
        logger.exception("Analytics insights failed: %s", e)
        return {
            "insights": [],
            "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
        }


@router.get("/goals/{goal_id}/forecast")
async def goal_forecast(
    goal_id: str,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Goal-specific forecast with RAG-style advice (e.g. "Reduce Wayne's Coffee by 15%
    to reach goal 2 months earlier") and SHAP contribution breakdown.
    """
    try:
        uid = user_id or "default"
        goal = await db.get(GoalRecord, goal_id)
        if not goal or goal.user_id != uid:
            raise HTTPException(404, "Goal not found")

        # Compute progress (reuse goals routes logic)
        from routes.goals import _compute_progress
        progress = await _compute_progress(db, goal, uid)

        records, _ = await list_transactions(
            db, user_id=uid, limit=200, order_by="desc"
        )
        # Filter by goal district if applicable
        if goal.district:
            records = [r for r in records if r.district == goal.district]
        if not records:
            records = []
            # Fallback: get all user transactions for context
            records, _ = await list_transactions(db, user_id=uid, limit=100, order_by="desc")

        result = await get_goal_forecast(
            goal_id=goal_id,
            goal_name=goal.name,
            goal_type=goal.goal_type,
            target_amount=float(goal.target_amount),
            current_amount=progress.current_amount,
            progress_pct=progress.progress_pct,
            trend=progress.trend,
            tx_records=records,
            district=goal.district,
        )
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Goal forecast failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
