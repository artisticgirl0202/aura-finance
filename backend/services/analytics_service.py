"""
Aura Finance — Analytics Service (Module 4/5/6 Simulation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Integrates budget vs actual comparison, spending trend prediction,
goal-specific RAG-style advice, and SHAP-style contribution attribution.
"""

from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from services.mock_ai_engine import (
    analyze_portfolio,
    assess_risk,
    generate_financial_advice,
    predict_spending_trend,
)
from services.stats_service import compute_stats_overview


# ─────────────────────────────────────────────────────────────────────────────
# Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class CategoryOverview(BaseModel):
    """Per-category budget vs actual + trend risk."""
    district: str
    spent: float
    limit: float
    utilization_pct: float  # 0–200+ (100 = at limit)
    trend_direction: str  # "rising" | "falling" | "stable" | "volatile"
    exceed_probability: float  # 0–1 (Module 4 meta-labeling)
    risk_level: str  # "low" | "moderate" | "high" | "critical"
    trend_explanation: str


class ShapContribution(BaseModel):
    """XAI — SHAP-style spending contribution to goal delay."""
    category: str
    amount: float
    share_pct: float
    shap_value: float  # contribution magnitude
    direction: str  # "positive" | "negative"
    description: str


class GoalForecastAdvice(BaseModel):
    """Module 6 RAG-style advice for a specific goal."""
    id: str
    title: str
    body: str
    action_items: list[str]
    estimated_impact: str
    shap_contributions: list[ShapContribution]
    months_saved: float  # positive = goal reached earlier


class AnalyticsOverviewResponse(BaseModel):
    """GET /analytics/overview response. Chart-ready for Phase 2 Stats Dashboard."""
    # Legacy / budget-based
    categories: list[CategoryOverview]
    ai_advice: list[dict]
    risk_score: float
    income_total: float
    expense_total: float
    updated_at: str
    # Phase 2: Chart-ready statistics
    spending_distribution: list[dict] = []   # [{ name, value, percent, color }] pie/donut
    month_over_month: dict = {}             # { this_month_expense, last_month_expense, change_pct, change_direction, ... }
    volatility: dict = {}                   # { std_dev, mean, coefficient_of_variation, volatility_level }
    monthly_trend: list[dict] = []          # [{ month, month_label, income, expense, balance }] line/area
    portfolio_score: float | None = None    # 0–100 AI 포트폴리오 점수
    savings_rate: float | None = None      # (income - expense) / income


class GoalForecastResponse(BaseModel):
    """GET /analytics/goals/{id}/forecast response."""
    goal_id: str
    goal_name: str
    goal_type: str
    target_amount: float
    current_amount: float
    progress_pct: float
    advice: GoalForecastAdvice | None
    months_to_goal: float | None  # estimated months remaining
    trend: str


# ─────────────────────────────────────────────────────────────────────────────
# Service Logic
# ─────────────────────────────────────────────────────────────────────────────


def _tx_to_dict(r: Any) -> dict:
    """Convert ORM or dict to engine format. Handles None/missing fields safely."""
    def _get(obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    ts = 0
    if hasattr(r, "tx_timestamp") and r.tx_timestamp is not None:
        try:
            ts = r.tx_timestamp.timestamp() * 1000
        except Exception:
            ts = 0
    elif isinstance(r, dict):
        raw = r.get("tx_timestamp") or r.get("timestamp")
        if isinstance(raw, str):
            try:
                from datetime import datetime as dt
                ts = dt.fromisoformat(raw.replace("Z", "+00:00")).timestamp() * 1000
            except Exception:
                ts = 0
        elif isinstance(raw, (int, float)):
            ts = float(raw)
        else:
            ts = 0
    else:
        raw = _get(r, "tx_timestamp") or _get(r, "timestamp")
        ts = float(raw) if isinstance(raw, (int, float)) else 0

    return {
        "description": str(_get(r, "description") or ""),
        "amount": float(_get(r, "amount") or 0),
        "district": str(_get(r, "district") or "Unknown"),
        "type": str(_get(r, "tx_type") or _get(r, "type") or "expense"),
        "timestamp": ts,
    }


def _compute_category_overview(
    tx_dicts: list[dict],
    budget_limits: dict[str, float],
    income_total: float,
) -> list[CategoryOverview]:
    """Aggregate spend by category, run M4 trend, compute exceed probability."""
    by_cat: dict[str, float] = defaultdict(float)
    for t in tx_dicts:
        if t.get("type", "expense") == "expense":
            cat = t.get("district", "Unknown")
            by_cat[cat] += abs(float(t.get("amount", 0)))

    expense_total = sum(by_cat.values())
    result: list[CategoryOverview] = []

    for district, limit in budget_limits.items():
        if limit <= 0:
            continue
        spent = by_cat.get(district, 0)
        util = (spent / limit) * 100 if limit > 0 else 0
        try:
            pred = predict_spending_trend(tx_dicts, district)
        except Exception:
            pred = None

        if pred:
            direction = pred.direction.value if hasattr(pred.direction, "value") else str(pred.direction)
            # Exceed probability: combine momentum + meta_label_confidence
            # Rising + high confidence → high exceed prob
            if direction == "rising" and pred.momentum_score > 0.2:
                exceed_prob = min(0.98, 0.5 + pred.meta_label_confidence * 0.5 + pred.momentum_score * 0.3)
            elif direction == "falling":
                exceed_prob = max(0.05, 0.3 - pred.momentum_score * 0.2)
            else:
                exceed_prob = 0.4 + (util / 100) * 0.4  # baseline from current utilization
            explanation = pred.explanation
        else:
            direction = "stable"
            exceed_prob = min(0.95, 0.2 + util / 120)
            explanation = f"Insufficient data for {district} trend."

        risk = (
            "critical" if util >= 100 or exceed_prob >= 0.9 else
            "high" if util >= 85 or exceed_prob >= 0.75 else
            "moderate" if util >= 70 or exceed_prob >= 0.55 else
            "low"
        )
        result.append(CategoryOverview(
            district=district,
            spent=round(spent, 2),
            limit=round(limit, 2),
            utilization_pct=round(util, 1),
            trend_direction=direction,
            exceed_probability=round(exceed_prob, 2),
            risk_level=risk,
            trend_explanation=(explanation or "")[:200],
        ))

    # Add categories with spend but no budget (informational)
    for district, spent in by_cat.items():
        if district not in budget_limits or budget_limits[district] <= 0:
            result.append(CategoryOverview(
                district=district,
                spent=round(spent, 2),
                limit=0,
                utilization_pct=0,
                trend_direction="stable",
                exceed_probability=0.3,
                risk_level="low",
                trend_explanation=f"{district} has no budget set.",
            ))

    return result


def _generate_goal_advice(
    goal_name: str,
    goal_type: str,
    target_amount: float,
    current_amount: float,
    by_cat: dict[str, float],
    top_merchant: str | None,
    top_merchant_amount: float,
) -> GoalForecastAdvice:
    """Module 6 RAG-style advice: concrete action (e.g. reduce Wayne's Coffee) with SHAP."""
    total_spent = sum(by_cat.values()) or 1
    shap_list: list[ShapContribution] = []
    for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1])[:5]:
        share = (amt / total_spent) * 100
        # SHAP: higher share + higher amount = more contribution to goal delay
        shap_val = (amt / 500) * (share / 20)  # heuristic
        shap_list.append(ShapContribution(
            category=cat,
            amount=round(amt, 2),
            share_pct=round(share, 1),
            shap_value=round(min(shap_val, 1.0), 3),
            direction="negative",
            description=f"{cat} contributes {share:.0f}% of discretionary spend.",
        ))

    # Concrete advice text
    if top_merchant and top_merchant_amount > 30:
        reduce_pct = 15
        saved = top_merchant_amount * (reduce_pct / 100)
        months_saved = saved / max(1, (target_amount - current_amount) / 12) if target_amount > current_amount else 2.0
        months_saved = min(months_saved, 24)
        body = (
            f"Reducing '{top_merchant}' spending by {reduce_pct}% could save ${saved:.0f}/month. "
            f"At current savings rate, '{goal_name}' target is ~{months_saved:.1f} months away; "
            f"applying this cut could shorten it by ~{max(0.5, months_saved - 2):.1f} months."
        )
        action_items = [
            f"Reduce {top_merchant} spending by {reduce_pct}%",
            "Review subscription or frequency of visits",
            "Set a monthly cap for this category",
        ]
    else:
        top_cat = max(by_cat.items(), key=lambda x: x[1])[0] if by_cat else "Food & Cafe"
        reduce_pct = 15
        cat_amt = by_cat.get(top_cat, 0)
        saved = cat_amt * (reduce_pct / 100)
        months_saved = 2.0
        body = (
            f"Cutting {top_cat} spending by {reduce_pct}% could save ${saved:.0f}/month. "
            f"Applying this to '{goal_name}' could bring the goal ~2 months closer."
        )
        action_items = [
            f"Set a sub-limit for {top_cat} at ${cat_amt * 0.85:.0f}/month",
            "Track daily spending in this category",
            "Identify 2–3 recurring charges to cut",
        ]

    return GoalForecastAdvice(
        id=f"goal_advice_{goal_name[:20]}_{int(datetime.now(timezone.utc).timestamp())}",
        title=f"Accelerate '{goal_name}' Goal",
        body=body,
        action_items=action_items,
        estimated_impact=f"Reduce timeline by ~{months_saved:.1f} months",
        shap_contributions=shap_list[:5],
        months_saved=round(months_saved, 1),
    )


async def get_analytics_overview(
    tx_records: list,
    budget_limits: dict[str, float],
    income_total: float,
) -> AnalyticsOverviewResponse:
    """Build full analytics overview with M4/M5/M6 simulation + Phase 2 chart-ready stats."""
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    expense_total = sum(
        abs(float(t.get("amount", 0)))
        for t in tx_dicts
        if t.get("type", "expense") == "expense"
    )

    # ── Budget vs actual + AI (existing) ─────────────────────────────────────
    try:
        categories = _compute_category_overview(tx_dicts, budget_limits, income_total)
    except Exception:
        categories = []

    try:
        risk = assess_risk(tx_dicts, budget_limits, income_total)
        risk_score_val = risk.overall_risk_score
    except Exception:
        risk_score_val = 20.0

    try:
        advice = generate_financial_advice(
            tx_dicts,
            budget_limits=budget_limits,
            income_monthly=income_total,
            max_advice=5,
        )
        ai_advice = [
            {
                "id": a.id,
                "title": a.title,
                "body": a.body,
                "action_items": a.action_items,
                "estimated_impact": a.estimated_impact,
                "supporting_data": a.supporting_data,
                "priority": a.priority.value if hasattr(a.priority, "value") else str(a.priority),
            }
            for a in advice
        ]
    except Exception:
        ai_advice = []

    # ── Phase 2: Chart-ready statistics ───────────────────────────────────────
    stats = {
        "spending_distribution": [],
        "month_over_month": {},
        "volatility": {},
        "monthly_trend": [],
    }
    try:
        stats = compute_stats_overview(
            tx_records,
            months_timeseries=6,
            months_volatility=3,
        )
    except Exception:
        pass  # keep empty defaults

    portfolio_score: float | None = None
    savings_rate: float | None = None
    try:
        portfolio = analyze_portfolio(tx_dicts, income_total=income_total, budget_limits=budget_limits)
        portfolio_score = portfolio.portfolio_score
        savings_rate = portfolio.savings_rate
    except Exception:
        pass

    return AnalyticsOverviewResponse(
        categories=categories,
        ai_advice=ai_advice,
        risk_score=risk_score_val,
        income_total=round(income_total, 2),
        expense_total=round(expense_total, 2),
        updated_at=datetime.now(timezone.utc).isoformat() + "Z",
        spending_distribution=stats.get("spending_distribution", []),
        month_over_month=stats.get("month_over_month", {}),
        volatility=stats.get("volatility", {}),
        monthly_trend=stats.get("monthly_trend", []),
        portfolio_score=portfolio_score,
        savings_rate=savings_rate,
    )


async def get_goal_forecast(
    goal_id: str,
    goal_name: str,
    goal_type: str,
    target_amount: float,
    current_amount: float,
    progress_pct: float,
    trend: str,
    tx_records: list,
    district: str | None,
) -> GoalForecastResponse:
    """Build goal-specific forecast with RAG advice and SHAP contributions."""
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    by_cat: dict[str, float] = defaultdict(float)
    merchant_totals: dict[str, float] = defaultdict(float)
    for t in tx_dicts:
        if t.get("type", "expense") == "expense":
            cat = t.get("district", "Unknown")
            amt = abs(float(t.get("amount", 0)))
            by_cat[cat] += amt
            desc = (t.get("description", "") or "").strip()[:50]
            if desc:
                merchant_totals[desc] += amt

    top_merchant = max(merchant_totals.items(), key=lambda x: x[1])[0] if merchant_totals else None
    top_merchant_amount = merchant_totals.get(top_merchant, 0) if top_merchant else 0

    advice = None
    months_to_goal = None
    if progress_pct < 100 and target_amount > current_amount:
        advice = _generate_goal_advice(
            goal_name, goal_type, target_amount, current_amount,
            by_cat, top_merchant, top_merchant_amount,
        )
        remaining = target_amount - current_amount
        monthly_save = sum(by_cat.values()) * 0.1 if by_cat else 100  # heuristic
        months_to_goal = remaining / monthly_save if monthly_save > 0 else 12

    return GoalForecastResponse(
        goal_id=goal_id,
        goal_name=goal_name,
        goal_type=goal_type,
        target_amount=target_amount,
        current_amount=current_amount,
        progress_pct=progress_pct,
        advice=advice,
        months_to_goal=round(months_to_goal, 1) if months_to_goal else None,
        trend=trend,
    )
