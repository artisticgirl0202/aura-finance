"""
Aura Finance — Financial Goals API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Core business logic: compare actual transaction history vs user-set goals,
compute real-time progress, trend, and AI-backed simulation.

Endpoints:
  POST  /api/v1/goals              — create goal
  GET   /api/v1/goals              — list user goals with live progress
  GET   /api/v1/goals/{id}         — single goal detail + transaction breakdown
  PUT   /api/v1/goals/{id}         — update goal definition
  DELETE /api/v1/goals/{id}        — archive goal
  GET   /api/v1/goals/{id}/progress — live progress computation (no cache)
  GET   /api/v1/goals/simulate     — "what-if" forecast simulation
  GET   /api/v1/goals/dashboard    — aggregated dashboard (all goals + M3/M4/M6 AI output)
"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.models import GoalRecord, TransactionRecord
from services.auth_service import get_optional_user_id
from services.guest_mock_data import get_guest_goals_dashboard, get_guest_goals_list

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/goals", tags=["goals"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    name:           str   = Field(..., min_length=2, max_length=128)
    description:    Optional[str] = None
    goal_type:      str   = Field(..., description="expense_limit|savings|income_target|investment|net_worth")
    target_amount:  float = Field(..., gt=0)
    district:       Optional[str] = None
    period_type:    str   = Field(default="monthly", description="monthly|annual|one_time")
    period_month:   Optional[str] = None   # "YYYY-MM" for monthly goals
    target_date:    Optional[date] = None
    icon:           str   = "target"
    color:          str   = "#10b981"


class GoalUpdate(BaseModel):
    name:           Optional[str]   = None
    description:    Optional[str]   = None
    target_amount:  Optional[float] = None
    district:       Optional[str]   = None
    target_date:    Optional[date]  = None
    icon:           Optional[str]   = None
    color:          Optional[str]   = None
    status:         Optional[str]   = None


class GoalProgressDetail(BaseModel):
    """Real-time progress calculation result."""
    goal_id:           str
    goal_name:         str
    goal_type:         str
    target_amount:     float
    current_amount:    float
    progress_pct:      float          # 0–100 (can exceed 100 = achieved)
    remaining:         float          # target - current (negative = exceeded/overshot)
    status:            str
    days_left:         Optional[int]
    daily_budget:      Optional[float]  # for expense_limit: how much per day left
    on_track:          bool
    trend:             str             # "ahead" | "on_track" | "at_risk" | "exceeded" | "achieved"
    ai_forecast:       Optional[str]   # M4 trend predictor text
    transactions_count: int
    period_label:      str


class GoalDashboard(BaseModel):
    """All goals + AI analysis for the dashboard."""
    total_goals:    int
    active_goals:   int
    achieved_goals: int
    at_risk_goals:  int
    goals:          list[dict]
    ai_advice:      list[dict]        # Module 6 advice relevant to goals
    portfolio_score: Optional[float]  # Module 3
    savings_rate:   Optional[float]


# ─────────────────────────────────────────────────────────────────────────────
# Internal: progress computation engine
# ─────────────────────────────────────────────────────────────────────────────

def _get_period_bounds(goal: GoalRecord) -> tuple[datetime, datetime]:
    """Return (start, end) datetime range for this goal's current period."""
    now = datetime.now(timezone.utc)

    if goal.period_type == "monthly":
        # Use the goal's stored period_month, or current month
        pm = goal.period_month or now.strftime("%Y-%m")
        year, month = int(pm[:4]), int(pm[5:7])
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        # End = first day of next month
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    elif goal.period_type == "annual":
        year = now.year
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end   = datetime(year + 1, 1, 1, tzinfo=timezone.utc)

    else:  # one_time
        start = goal.created_at if goal.created_at.tzinfo else goal.created_at.replace(tzinfo=timezone.utc)
        end   = (
            datetime.combine(goal.target_date, datetime.max.time(), tzinfo=timezone.utc)
            if goal.target_date else now + timedelta(days=365)
        )

    return start, end


async def _compute_progress(
    db: AsyncSession,
    goal: GoalRecord,
    user_id: str,
) -> GoalProgressDetail:
    """
    Core business logic: query transactions in period and compute progress.

    Logic per goal_type:
      expense_limit  — sum of expenses for district/all in period (lower = better)
      savings        — (sum income) − (sum expense) in period
      income_target  — sum of income transactions in period
      investment     — sum of investment transactions in period
      net_worth      — (total income ever) − (total expense ever)
    """
    start, end = _get_period_bounds(goal)
    now = datetime.now(timezone.utc)

    # ── Base filter ───────────────────────────────────────────────────────────
    base_filters = [
        TransactionRecord.user_id == user_id,
        TransactionRecord.tx_timestamp >= start,
        TransactionRecord.tx_timestamp < end,
    ]
    if goal.district:
        base_filters.append(TransactionRecord.district == goal.district)

    # ── Query actual amounts by type ──────────────────────────────────────────
    async def _sum_type(tx_type: str, extra_filters=None) -> float:
        filters = base_filters + [TransactionRecord.tx_type == tx_type]
        if extra_filters:
            filters += extra_filters
        stmt = select(func.coalesce(func.sum(TransactionRecord.amount), 0.0)).where(and_(*filters))
        return float((await db.execute(stmt)).scalar_one())

    async def _count_type(tx_type: str) -> int:
        filters = base_filters + [TransactionRecord.tx_type == tx_type]
        stmt = select(func.count(TransactionRecord.id)).where(and_(*filters))
        return int((await db.execute(stmt)).scalar_one())

    expense_sum    = await _sum_type("expense")
    income_sum     = await _sum_type("income")
    investment_sum = await _sum_type("investment")
    expense_count  = await _count_type("expense")
    income_count   = await _count_type("income")
    invest_count   = await _count_type("investment")

    # ── Compute current_amount and progress ────────────────────────────────────
    gt = goal.goal_type

    if gt == "expense_limit":
        current  = expense_sum
        progress = (current / goal.target_amount) * 100  # lower is BETTER → >100 = over budget
        on_track = current <= goal.target_amount * 0.85
        tx_count = expense_count
        trend    = (
            "achieved" if current == 0 else
            "ahead"    if current <= goal.target_amount * 0.70 else
            "on_track" if current <= goal.target_amount * 0.85 else
            "at_risk"  if current <= goal.target_amount else
            "exceeded"
        )

    elif gt == "savings":
        current  = max(0.0, income_sum - expense_sum)
        progress = (current / goal.target_amount) * 100
        on_track = current >= goal.target_amount * 0.80
        tx_count = income_count + expense_count
        trend    = (
            "achieved" if progress >= 100 else
            "ahead"    if progress >= 90  else
            "on_track" if progress >= 70  else
            "at_risk"
        )

    elif gt == "income_target":
        current  = income_sum
        progress = (current / goal.target_amount) * 100
        on_track = current >= goal.target_amount * 0.80
        tx_count = income_count
        trend    = (
            "achieved" if progress >= 100 else
            "ahead"    if progress >= 90  else
            "on_track" if progress >= 70  else
            "at_risk"
        )

    elif gt == "investment":
        current  = investment_sum
        progress = (current / goal.target_amount) * 100
        on_track = current >= goal.target_amount * 0.80
        tx_count = invest_count
        trend    = (
            "achieved" if progress >= 100 else
            "ahead"    if progress >= 90  else
            "on_track" if progress >= 70  else
            "at_risk"
        )

    else:  # net_worth (uses all-time data)
        all_income = float((await db.execute(
            select(func.coalesce(func.sum(TransactionRecord.amount), 0.0))
            .where(and_(TransactionRecord.user_id == user_id, TransactionRecord.tx_type == "income"))
        )).scalar_one())
        all_expense = float((await db.execute(
            select(func.coalesce(func.sum(TransactionRecord.amount), 0.0))
            .where(and_(TransactionRecord.user_id == user_id, TransactionRecord.tx_type == "expense"))
        )).scalar_one())
        current  = all_income - all_expense
        progress = (current / goal.target_amount) * 100 if goal.target_amount else 0
        on_track = current >= goal.target_amount * 0.80
        tx_count = expense_count + income_count
        trend    = "achieved" if progress >= 100 else "on_track" if current > 0 else "at_risk"

    # ── Days left + daily budget ──────────────────────────────────────────────
    days_left = None
    daily_budget = None

    if goal.period_type in ("monthly", "annual"):
        days_left = max(0, (end - now).days)
        if gt == "expense_limit" and days_left > 0:
            remaining_budget = goal.target_amount - current
            daily_budget = round(max(0.0, remaining_budget / days_left), 2)
    elif goal.target_date:
        days_left = max(0, (goal.target_date - now.date()).days)

    # ── Auto-achieve detection ────────────────────────────────────────────────
    status = goal.status
    if status == "active":
        if gt == "expense_limit" and trend == "achieved":
            pass   # expense_limit "achieved" means $0 spent — unusual, keep active
        elif trend == "achieved" and progress >= 100:
            status = "achieved"

    # ── Period label ──────────────────────────────────────────────────────────
    if goal.period_type == "monthly":
        period_label = (goal.period_month or now.strftime("%Y-%m"))
    elif goal.period_type == "annual":
        period_label = str(now.year)
    else:
        period_label = f"by {goal.target_date}" if goal.target_date else "one-time"

    # ── AI forecast (Module 4 — trend predictor) ──────────────────────────────
    ai_forecast = None
    try:
        from services.mock_ai_engine import predict_spending_trend
        # Build minimal tx dict list for trend prediction
        tx_stmt = (
            select(TransactionRecord)
            .where(and_(
                TransactionRecord.user_id == user_id,
                TransactionRecord.tx_type.in_(["expense", "income", "investment"]),
                *([TransactionRecord.district == goal.district] if goal.district else []),
            ))
            .order_by(TransactionRecord.tx_timestamp)
            .limit(50)
        )
        tx_rows = (await db.execute(tx_stmt)).scalars().all()
        tx_dicts = [
            {
                "description": r.description,
                "amount":      r.amount,
                "district":    r.district,
                "type":        r.tx_type,
                "timestamp":   r.tx_timestamp.timestamp() * 1000 if r.tx_timestamp else 0,
            }
            for r in tx_rows
        ]
        if tx_dicts and goal.district:
            pred = predict_spending_trend(tx_dicts, goal.district)
            ai_forecast = pred.explanation[:120]
    except Exception as exc:
        logger.debug(f"AI forecast skipped: {exc}")

    return GoalProgressDetail(
        goal_id=goal.id,
        goal_name=goal.name,
        goal_type=goal.goal_type,
        target_amount=round(goal.target_amount, 2),
        current_amount=round(current, 2),
        progress_pct=round(min(progress, 999.0), 1),
        remaining=round(goal.target_amount - current, 2),
        status=status,
        days_left=days_left,
        daily_budget=daily_budget,
        on_track=on_track,
        trend=trend,
        ai_forecast=ai_forecast,
        transactions_count=tx_count,
        period_label=period_label,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_goal(
    payload: GoalCreate,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new financial goal."""
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to create goals.",
        )
    uid = user_id or "default"
    # Default period_month to current month for monthly goals
    pm = payload.period_month
    if payload.period_type == "monthly" and not pm:
        pm = datetime.now(timezone.utc).strftime("%Y-%m")

    goal = GoalRecord(
        id=str(uuid.uuid4()),
        user_id=uid,
        name=payload.name,
        description=payload.description,
        goal_type=payload.goal_type,
        target_amount=payload.target_amount,
        district=payload.district,
        period_type=payload.period_type,
        period_month=pm,
        target_date=payload.target_date,
        icon=payload.icon,
        color=payload.color,
    )
    db.add(goal)
    await db.flush()
    await db.commit()

    # Immediately compute progress so the response is fully populated
    progress = await _compute_progress(db, goal, uid)
    return _goal_to_dict(goal, progress)


@router.get("")
async def list_goals(
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    List all goals with live progress for the current user.
    Each goal includes real-time progress computed from the transaction DB.
    게스트 모드: Mock 목표 목록 반환.
    """
    if user_id == "guest":
        return get_guest_goals_list()
    uid = user_id or "default"

    filters = [GoalRecord.user_id == uid]
    if status_filter:
        filters.append(GoalRecord.status == status_filter)
    else:
        # By default exclude archived goals
        filters.append(GoalRecord.status != "archived")

    stmt = select(GoalRecord).where(and_(*filters)).order_by(GoalRecord.created_at.desc())
    goals = list((await db.execute(stmt)).scalars().all())

    results = []
    for g in goals:
        try:
            progress = await _compute_progress(db, g, uid)
            # Auto-update status if newly achieved
            if progress.status != g.status and progress.status == "achieved":
                g.status = "achieved"
                g.cached_progress_pct = progress.progress_pct
                g.cached_current_amt  = progress.current_amount
            results.append(_goal_to_dict(g, progress))
        except Exception as exc:
            logger.warning(f"Progress calc failed for goal {g.id}: {exc}")
            results.append(_goal_to_dict(g, None))

    await db.commit()
    return {"total": len(results), "goals": results}


@router.get("/dashboard")
async def goals_dashboard(
    income_monthly: float = Query(0.0),
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Full goal dashboard: all goals + AI portfolio + advice.
    Powers the right-side panel in the 3D city UI.
    게스트 모드: Mock 대시보드 반환.
    """
    if user_id == "guest":
        return get_guest_goals_dashboard(income_monthly or 6050.0)
    uid = user_id or "default"

    stmt = select(GoalRecord).where(
        and_(GoalRecord.user_id == uid, GoalRecord.status != "archived")
    )
    goals = list((await db.execute(stmt)).scalars().all())

    goal_results = []
    for g in goals:
        try:
            progress = await _compute_progress(db, g, uid)
            goal_results.append(_goal_to_dict(g, progress))
        except Exception:
            goal_results.append(_goal_to_dict(g, None))

    # ── Fetch recent transactions for AI analysis ─────────────────────────────
    tx_stmt = (
        select(TransactionRecord)
        .where(TransactionRecord.user_id == uid)
        .order_by(TransactionRecord.tx_timestamp.desc())
        .limit(200)
    )
    tx_rows = list((await db.execute(tx_stmt)).scalars().all())
    tx_dicts = [
        {
            "description": r.description,
            "amount":      r.amount,
            "district":    r.district,
            "type":        r.tx_type,
            "timestamp":   r.tx_timestamp.timestamp() * 1000 if r.tx_timestamp else 0,
        }
        for r in tx_rows
    ]

    # ── M3 portfolio + M6 advice ──────────────────────────────────────────────
    portfolio_score = None
    savings_rate    = None
    ai_advice       = []
    budget_limits   = {g.district: g.target_amount for g in goals if g.goal_type == "expense_limit" and g.district}

    if tx_dicts:
        try:
            from services.mock_ai_engine import analyze_portfolio, generate_financial_advice, assess_risk
            portfolio = analyze_portfolio(tx_dicts, income_total=income_monthly, budget_limits=budget_limits)
            risk      = assess_risk(tx_dicts, budget_limits=budget_limits, income_monthly=income_monthly)
            advice    = generate_financial_advice(
                tx_dicts, portfolio=portfolio, risk=risk,
                budget_limits=budget_limits, income_monthly=income_monthly, max_advice=4
            )
            portfolio_score = portfolio.portfolio_score
            savings_rate    = portfolio.savings_rate
            ai_advice       = [a.model_dump() for a in advice]
        except Exception as exc:
            logger.warning(f"AI analysis skipped: {exc}")

    active   = sum(1 for g in goal_results if g.get("status") == "active")
    achieved = sum(1 for g in goal_results if g.get("status") == "achieved")
    at_risk  = sum(1 for g in goal_results if g.get("progress", {}).get("trend") == "at_risk")

    return GoalDashboard(
        total_goals=len(goal_results),
        active_goals=active,
        achieved_goals=achieved,
        at_risk_goals=at_risk,
        goals=goal_results,
        ai_advice=ai_advice,
        portfolio_score=portfolio_score,
        savings_rate=savings_rate,
    )


@router.get("/simulate")
async def simulate_goal(
    goal_type:     str   = Query(..., description="expense_limit|savings|income_target|investment"),
    target_amount: float = Query(..., gt=0),
    monthly_income: float = Query(0.0),
    current_pace:  float = Query(0.0, description="Current monthly spend/save pace"),
    months_ahead:  int   = Query(3, ge=1, le=24),
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    "What-if" goal simulation: project whether the user will hit a target
    at the current pace over the next N months.

    No transactions required — works as a standalone planning calculator.
    """
    uid = user_id or "default"

    # If current_pace not provided, compute from last 30-day DB average
    if current_pace == 0.0:
        now = datetime.now(timezone.utc)
        stmt = select(func.coalesce(func.avg(TransactionRecord.amount), 0.0)).where(
            and_(
                TransactionRecord.user_id == uid,
                TransactionRecord.tx_type == ("income" if goal_type in ("savings", "income_target") else "expense"),
                TransactionRecord.tx_timestamp >= now - timedelta(days=30),
            )
        )
        current_pace = float((await db.execute(stmt)).scalar_one()) * 20  # rough monthly est

    # Projection (simple linear model)
    projections = []
    cumulative = 0.0
    achieved_month = None

    for m in range(1, months_ahead + 1):
        if goal_type == "savings":
            monthly_delta = max(0.0, monthly_income - current_pace)
        elif goal_type == "expense_limit":
            monthly_delta = current_pace   # spend going up
        else:
            monthly_delta = current_pace

        cumulative += monthly_delta
        progress_pct = min(200.0, (cumulative / target_amount) * 100)
        on_track = cumulative <= target_amount if goal_type == "expense_limit" else cumulative >= target_amount * 0.8

        if achieved_month is None and (
            (goal_type == "expense_limit" and cumulative <= target_amount) or
            (goal_type != "expense_limit" and progress_pct >= 100)
        ):
            achieved_month = m

        projections.append({
            "month":        m,
            "cumulative":   round(cumulative, 2),
            "progress_pct": round(progress_pct, 1),
            "on_track":     on_track,
            "delta":        round(monthly_delta, 2),
        })

    overall_achievable = achieved_month is not None
    recommendation = (
        f"At your current pace of ${current_pace:.0f}/month, "
        + (
            f"you'll reach your ${target_amount:.0f} goal in month {achieved_month}."
            if overall_achievable
            else f"you won't reach your ${target_amount:.0f} goal in {months_ahead} months. "
                 f"Increase your pace by ${(target_amount / months_ahead - current_pace):.0f}/month."
        )
    )

    return {
        "goal_type":     goal_type,
        "target_amount": target_amount,
        "current_pace":  round(current_pace, 2),
        "months_ahead":  months_ahead,
        "achievable":    overall_achievable,
        "achieved_month": achieved_month,
        "recommendation": recommendation,
        "projections":   projections,
    }


@router.get("/{goal_id}/progress")
async def get_goal_progress(
    goal_id: str,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Live progress for a single goal (no cache — always fresh from DB)."""
    if user_id == "guest":
        goals_list = get_guest_goals_list()
        for g in goals_list.get("goals", []):
            if g.get("id") == goal_id and g.get("progress"):
                return g["progress"]
        raise HTTPException(404, "Goal not found")
    uid = user_id or "default"
    goal = await db.get(GoalRecord, goal_id)
    if not goal or goal.user_id != uid:
        raise HTTPException(404, "Goal not found")
    return await _compute_progress(db, goal, uid)


@router.get("/{goal_id}")
async def get_goal(
    goal_id: str,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id == "guest":
        goals_list = get_guest_goals_list()
        for g in goals_list.get("goals", []):
            if g.get("id") == goal_id:
                return g
        raise HTTPException(404, "Goal not found")
    uid = user_id or "default"
    goal = await db.get(GoalRecord, goal_id)
    if not goal or goal.user_id != uid:
        raise HTTPException(404, "Goal not found")
    progress = await _compute_progress(db, goal, uid)
    return _goal_to_dict(goal, progress)


@router.put("/{goal_id}")
async def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to edit goals.",
        )
    uid = user_id or "default"
    goal = await db.get(GoalRecord, goal_id)
    if not goal or goal.user_id != uid:
        raise HTTPException(404, "Goal not found")

    if payload.name           is not None: goal.name           = payload.name
    if payload.description    is not None: goal.description    = payload.description
    if payload.target_amount  is not None: goal.target_amount  = payload.target_amount
    if payload.district       is not None: goal.district       = payload.district
    if payload.target_date    is not None: goal.target_date    = payload.target_date
    if payload.icon           is not None: goal.icon           = payload.icon
    if payload.color          is not None: goal.color          = payload.color
    if payload.status         is not None: goal.status         = payload.status
    goal.updated_at = datetime.now(timezone.utc)

    await db.commit()
    progress = await _compute_progress(db, goal, uid)
    return _goal_to_dict(goal, progress)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to delete goals.",
        )
    uid = user_id or "default"
    goal = await db.get(GoalRecord, goal_id)
    if not goal or goal.user_id != uid:
        raise HTTPException(404, "Goal not found")
    goal.status = "archived"
    await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _goal_to_dict(goal: GoalRecord, progress: Optional[GoalProgressDetail]) -> dict:
    d = {
        "id":           goal.id,
        "name":         goal.name,
        "description":  goal.description,
        "goal_type":    goal.goal_type,
        "target_amount": goal.target_amount,
        "district":     goal.district,
        "period_type":  goal.period_type,
        "period_month": goal.period_month,
        "target_date":  str(goal.target_date) if goal.target_date else None,
        "icon":         goal.icon,
        "color":        goal.color,
        "status":       goal.status,
        "created_at":   goal.created_at.isoformat() if goal.created_at else None,
    }
    if progress:
        d["progress"] = progress.model_dump()
    return d
