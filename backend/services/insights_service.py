"""
Aura Finance — AI Insights Service (Phase 3: Smart Alerts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

유저 잔고, 이번 달 지출, 목표 진행률을 분석하여
경고 또는 칭찬 메시지(AI Insight)를 생성.

Production: LLM/Gemini로 확장 가능. 현재는 규칙 기반.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AIInsight:
    """단일 AI 인사이트 (Toast 알림용)."""
    id: str
    type: str          # "warning" | "praise"
    title: str
    message: str
    priority: str      # "urgent" | "high" | "medium" | "low"
    icon: str
    created_at: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat() + "Z"


def _insight_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.now(timezone.utc).timestamp())}"


def generate_insights(
    balance: float,
    this_month_income: float,
    this_month_expense: float,
    goals_with_progress: list[dict[str, Any]],
    budget_limits: dict[str, float],
    category_spent: dict[str, float],
) -> list[AIInsight]:
    """
    잔고, 월별 수입/지출, 목표 진행률을 분석해 AI 인사이트 생성.
    경고(negative)와 칭찬(positive)을 균형있게 반환.
    """
    insights: list[AIInsight] = []

    # ── 1. Balance warnings ───────────────────────────────────────────────────
    if balance < 0:
        insights.append(AIInsight(
            id=_insight_id("balance_neg"),
            type="warning",
            title="Negative Balance",
            message=f"Your current balance is ${balance:,.0f}. Consider reducing spending or increasing income.",
            priority="urgent",
            icon="⚠️",
            created_at=_now_iso(),
        ))
    elif balance < 500 and this_month_expense > 0:
        insights.append(AIInsight(
            id=_insight_id("balance_low"),
            type="warning",
            title="Low Balance",
            message=f"Balance of ${balance:,.0f} is low. We recommend keeping at least one month of expenses as emergency funds.",
            priority="high",
            icon="💸",
            created_at=_now_iso(),
        ))

    # ── 2. 저축률 / 수입 대비 지출 ──────────────────────────────────────────────
    if this_month_income > 0:
        savings = this_month_income - this_month_expense
        savings_rate = savings / this_month_income
        if savings_rate < 0:
            insights.append(AIInsight(
                id=_insight_id("overspend"),
                type="warning",
                title="Overspent",
                message="This month's expenses exceeded income. Review your budget and trim non-essential spending.",
                priority="urgent",
                icon="📉",
                created_at=_now_iso(),
            ))
        elif savings_rate >= 0.2:
            insights.append(AIInsight(
                id=_insight_id("savings_good"),
                type="praise",
                title="Great Savings Rate",
                message=f"Savings rate {savings_rate*100:.0f}% — excellent progress. Keep it up!",
                priority="medium",
                icon="🌟",
                created_at=_now_iso(),
            ))

    # ── 3. 목표 달성 칭찬 / 경고 ───────────────────────────────────────────────
    achieved = [g for g in goals_with_progress if (g.get("progress", {}) or {}).get("trend") == "achieved"]
    at_risk = [g for g in goals_with_progress if (g.get("progress", {}) or {}).get("trend") in ("at_risk", "exceeded")]

    if achieved:
        names = ", ".join(g.get("name", "Goal")[:20] for g in achieved[:3])
        insights.append(AIInsight(
            id=_insight_id("goal_achieved"),
            type="praise",
            title="Goal Achieved",
            message=f"Achieved '{names}'! 🎉",
            priority="medium",
            icon="🏆",
            created_at=_now_iso(),
        ))

    if at_risk:
        names = ", ".join(g.get("name", "Goal")[:20] for g in at_risk[:2])
        insights.append(AIInsight(
            id=_insight_id("goal_at_risk"),
            type="warning",
            title="Goal at Risk",
            message=f"'{names}' is at risk. Consider adjusting your spending.",
            priority="high",
            icon="⚠️",
            created_at=_now_iso(),
        ))

    # ── 4. 예산 초과 카테고리 ───────────────────────────────────────────────────
    for district, limit in budget_limits.items():
        if limit <= 0:
            continue
        spent = category_spent.get(district, 0)
        util = spent / limit if limit > 0 else 0
        if util >= 1.0:
            insights.append(AIInsight(
                id=_insight_id(f"over_{district[:10]}"),
                type="warning",
                title="Budget Exceeded",
                message=f"{district} spending exceeded budget by ${spent - limit:,.0f} (limit ${limit:,.0f}).",
                priority="high",
                icon="🚨",
                created_at=_now_iso(),
            ))
        elif util >= 0.9 and util < 1.0:
            insights.append(AIInsight(
                id=_insight_id(f"near_{district[:10]}"),
                type="warning",
                title="Budget Near Limit",
                message=f"{district} at {(util*100):.0f}% of budget. Watch out before it runs out.",
                priority="medium",
                icon="📊",
                created_at=_now_iso(),
            ))

    # ── 5. 긍정적 인사이트 (데이터가 있을 때) ───────────────────────────────────
    if not any(i.type == "praise" for i in insights) and this_month_income > 0 and this_month_expense > 0:
        if this_month_expense < this_month_income * 0.7:
            insights.append(AIInsight(
                id=_insight_id("spend_ok"),
                type="praise",
                title="Healthy Spending",
                message="Spending is under 70% of income. You're managing your finances well.",
                priority="low",
                icon="👍",
                created_at=_now_iso(),
            ))

    # 우선순위 정렬: urgent > high > medium > low
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    insights.sort(key=lambda x: (priority_order.get(x.priority, 4), 0 if x.type == "warning" else 1))

    return insights[:10]  # 최대 10개


def insights_to_dicts(insights: list[AIInsight]) -> list[dict[str, Any]]:
    """AIInsight 리스트를 API 응답용 dict로 변환."""
    return [
        {
            "id": i.id,
            "type": i.type,
            "title": i.title,
            "message": i.message,
            "priority": i.priority,
            "icon": i.icon,
            "created_at": i.created_at,
        }
        for i in insights
    ]
