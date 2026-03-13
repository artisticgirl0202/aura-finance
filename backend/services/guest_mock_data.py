"""
Aura Finance — Guest Mode Mock Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

풍부한 가상 데이터 for Phase 1–3 demo (잔고, 목표, 차트, AI 인사이트 등).
게스트가 'Login as Guest' 시 실제 DB를 조회하지 않고 이 데이터를 반환.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat() + "Z"


def _ts(days_ago: int) -> int:
    """Timestamp ms, N days ago."""
    from datetime import timedelta
    t = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return int(t.timestamp() * 1000)


def _ts_iso(days_ago: int) -> str:
    """ISO string, N days ago."""
    from datetime import timedelta
    t = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return t.isoformat() + "Z"


# ── Finance Overview (Phase 1) ──────────────────────────────────────────────

def get_guest_finance_overview() -> dict[str, Any]:
    """잔고, 최근 거래, 목표별 진행률 — 풍부한 데모 데이터."""
    return {
        "balance": 12450.75,
        "currency": "USD",
        "recent_transactions": [
            {"id": "g1", "description": "Salary — Aura Corp", "amount": 5200.0, "currency": "USD",
             "tx_type": "income", "district": "Salary", "tx_timestamp": _ts(5), "source": "mock"},
            {"id": "g2", "description": "Freelance — Web Design", "amount": 850.0, "currency": "USD",
             "tx_type": "income", "district": "Freelance", "tx_timestamp": _ts(12), "source": "mock"},
            {"id": "g3", "description": "Wayne's Coffee", "amount": -14.50, "currency": "USD",
             "tx_type": "expense", "district": "Food & Cafe", "tx_timestamp": _ts(1), "source": "mock"},
            {"id": "g4", "description": "Grocery — Whole Foods", "amount": -112.80, "currency": "USD",
             "tx_type": "expense", "district": "Food & Cafe", "tx_timestamp": _ts(2), "source": "mock"},
            {"id": "g5", "description": "Netflix Subscription", "amount": -15.99, "currency": "USD",
             "tx_type": "expense", "district": "Entertainment", "tx_timestamp": _ts(3), "source": "mock"},
            {"id": "g6", "description": "Uber — Airport", "amount": -45.00, "currency": "USD",
             "tx_type": "expense", "district": "Transport", "tx_timestamp": _ts(4), "source": "mock"},
            {"id": "g7", "description": "Apple Music", "amount": -9.99, "currency": "USD",
             "tx_type": "expense", "district": "Entertainment", "tx_timestamp": _ts(6), "source": "mock"},
            {"id": "g8", "description": "Stocks — VTI ETF", "amount": 500.0, "currency": "USD",
             "tx_type": "investment", "district": "Stocks", "tx_timestamp": _ts(7), "source": "mock"},
        ],
        "goals_with_progress": get_guest_goals_with_progress(),
        "updated_at": _now_iso(),
    }


def get_guest_goals_with_progress() -> list[dict[str, Any]]:
    """목표별 진행률 — 데모용."""
    return [
        {
            "id": "guest-goal-1",
            "name": "Monthly Food Budget",
            "description": "Cafe & groceries limit",
            "goal_type": "expense_limit",
            "target_amount": 600.0,
            "district": "Food & Cafe",
            "period_type": "monthly",
            "period_month": datetime.now(timezone.utc).strftime("%Y-%m"),
            "target_date": None,
            "icon": "target",
            "color": "#10b981",
            "status": "active",
            "created_at": _now_iso(),
            "progress": {
                "goal_id": "guest-goal-1",
                "goal_name": "Monthly Food Budget",
                "goal_type": "expense_limit",
                "target_amount": 600.0,
                "current_amount": 127.30,
                "progress_pct": 21.2,
                "remaining": 472.70,
                "status": "active",
                "days_left": 26,
                "daily_budget": 18.18,
                "on_track": True,
                "trend": "ahead",
                "ai_forecast": "Spending pace is below target. You can reach month-end well under budget.",
                "transactions_count": 12,
                "period_label": datetime.now(timezone.utc).strftime("%Y-%m"),
            },
        },
        {
            "id": "guest-goal-2",
            "name": "Emergency Fund",
            "description": "6 months savings",
            "goal_type": "savings",
            "target_amount": 12000.0,
            "district": None,
            "period_type": "one_time",
            "period_month": None,
            "target_date": None,
            "icon": "target",
            "color": "#06b6d4",
            "status": "active",
            "created_at": _now_iso(),
            "progress": {
                "goal_id": "guest-goal-2",
                "goal_name": "Emergency Fund",
                "goal_type": "savings",
                "target_amount": 12000.0,
                "current_amount": 8540.0,
                "progress_pct": 71.2,
                "remaining": 3460.0,
                "status": "active",
                "days_left": None,
                "daily_budget": None,
                "on_track": True,
                "trend": "on_track",
                "ai_forecast": "At current pace, goal reachable in ~4 months.",
                "transactions_count": 48,
                "period_label": "one-time",
            },
        },
    ]


# ── Analytics Overview (Phase 2) ──────────────────────────────────────────────

def get_guest_analytics_overview() -> dict[str, Any]:
    """Budget vs actual, M4 trend, M6 advice — 차트/대시보드 풍부한 데이터."""
    now = datetime.now(timezone.utc)
    return {
        "categories": [
            {"district": "Food & Cafe", "spent": 342.50, "limit": 600.0, "utilization_pct": 57.1,
             "trend_direction": "stable", "exceed_probability": 0.12, "risk_level": "low",
             "trend_explanation": "Spending consistent with last 3 months."},
            {"district": "Entertainment", "spent": 68.00, "limit": 150.0, "utilization_pct": 45.3,
             "trend_direction": "falling", "exceed_probability": 0.05, "risk_level": "low",
             "trend_explanation": "Entertainment spend down 15% vs last month."},
            {"district": "Transport", "spent": 120.00, "limit": 200.0, "utilization_pct": 60.0,
             "trend_direction": "rising", "exceed_probability": 0.35, "risk_level": "moderate",
             "trend_explanation": "Uber trips increased this week."},
            {"district": "Shopping", "spent": 245.00, "limit": 300.0, "utilization_pct": 81.7,
             "trend_direction": "stable", "exceed_probability": 0.58, "risk_level": "high",
             "trend_explanation": "Electronics purchase pushed utilization up."},
        ],
        "ai_advice": [
            {"title": "Reduce Food & Cafe by 10%", "body": "Trim ~$35/month, reach savings goal 2 months earlier.", "priority": "medium"},
            {"title": "Transport budget at 60%", "body": "Consider carpooling to stay under $200.", "priority": "low"},
        ],
        "risk_score": 32.0,
        "income_total": 6050.0,
        "expense_total": 3218.50,
        "updated_at": _now_iso(),
        "spending_distribution": [
            {"name": "Food & Cafe", "value": 342.50, "percent": 32.1, "color": "#10b981"},
            {"name": "Shopping", "value": 245.00, "percent": 23.0, "color": "#f59e0b"},
            {"name": "Transport", "value": 120.00, "percent": 11.3, "color": "#3b82f6"},
            {"name": "Entertainment", "value": 68.00, "percent": 6.4, "color": "#8b5cf6"},
            {"name": "Other", "value": 2443.00, "percent": 27.2, "color": "#64748b"},
        ],
        "month_over_month": {
            "this_month_expense": 3218.50,
            "last_month_expense": 2890.20,
            "change_pct": 11.4,
            "change_direction": "rising",
            "this_month_income": 6050.0,
            "last_month_income": 5850.0,
        },
        "volatility": {
            "std_dev": 420.5,
            "mean": 3100.0,
            "coefficient_of_variation": 0.136,
            "volatility_level": "moderate",
            "months_analyzed": 6,
        },
        "monthly_trend": [
            {"month": "2025-09", "month_label": "Sep", "income": 5200.0, "expense": 2450.0, "balance": 2750.0},
            {"month": "2025-10", "month_label": "Oct", "income": 5850.0, "expense": 2890.2, "balance": 2959.8},
            {"month": "2025-11", "month_label": "Nov", "income": 6050.0, "expense": 3218.5, "balance": 2831.5},
        ],
        "portfolio_score": 72.5,
        "savings_rate": 0.28,
    }


# ── Analytics Insights (Phase 3: AI Smart Alerts) ─────────────────────────────

def get_guest_insights() -> list[dict[str, Any]]:
    """AI insights — warning/praise messages (English)."""
    return [
        {"id": "guest-ins-1", "type": "praise", "title": "Great Savings Rate",
         "message": "Savings rate 28% — excellent progress toward your goals. Keep it up!", "priority": "medium", "icon": "🌟", "created_at": _now_iso()},
        {"id": "guest-ins-2", "type": "info", "title": "Goal in Progress",
         "message": "Emergency Fund goal 71% complete. You're almost there!", "priority": "low", "icon": "👍", "created_at": _now_iso()},
    ]


# ── Goals Dashboard ───────────────────────────────────────────────────────────

def get_guest_goals_dashboard(income_monthly: float = 6050.0) -> dict[str, Any]:
    """목표 대시보드 + AI 포트폴리오/조언."""
    goals = get_guest_goals_with_progress()
    return {
        "total_goals": 2,
        "active_goals": 2,
        "achieved_goals": 0,
        "at_risk_goals": 0,
        "goals": goals,
        "ai_advice": [
            {"title": "Reduce Food & Cafe by 10%", "body": "Trim ~$35/month to reach Emergency Fund 2 months earlier.", "priority": "medium"},
        ],
        "portfolio_score": 72.5,
        "savings_rate": 0.28,
    }


# ── Goals List (GET /goals) ───────────────────────────────────────────────────

def get_guest_goals_list() -> dict[str, Any]:
    """List goals response."""
    return {"total": 2, "goals": get_guest_goals_with_progress()}


# ── Transactions (for guest: recent/mock) ────────────────────────────────────

def get_guest_transactions(limit: int = 50) -> list[dict[str, Any]]:
    """최근 거래 목록 — list_tx API 형식 (_tx_to_dict 호환)."""
    overview = get_guest_finance_overview()
    tx_list = overview["recent_transactions"][:limit]
    return [
        {
            "id": t["id"],
            "description": t["description"],
            "amount": t["amount"],
            "currency": t.get("currency", "USD"),
            "type": t["tx_type"],
            "district": t["district"],
            "confidence": 0.92,
            "reason": None,
            "icon": "💳",
            "color": "#10b981",
            "ai_engine": "mock",
            "source": t.get("source", "mock"),
            "is_anomaly": False,
            "anomaly_score": None,
            "anomaly_type": None,
            "tx_timestamp": _ts_iso(i + 1),
            "created_at": _now_iso(),
        }
        for i, t in enumerate(tx_list)
    ]


# ── Stats (for guest: by-district, time-series, anomalies) ────────────────────

def get_guest_stats_by_district(tx_type: str = "expense") -> list[dict[str, Any]]:
    """Spending by district — pie chart feed."""
    return [
        {"district": "Food & Cafe", "total": 342.50, "count": 12, "avg_amount": 28.54, "last_tx": _now_iso()},
        {"district": "Shopping", "total": 245.00, "count": 4, "avg_amount": 61.25, "last_tx": _now_iso()},
        {"district": "Transport", "total": 120.00, "count": 6, "avg_amount": 20.00, "last_tx": _now_iso()},
        {"district": "Entertainment", "total": 68.00, "count": 3, "avg_amount": 22.67, "last_tx": _now_iso()},
    ]


def get_guest_stats_time_series(days: int = 30) -> list[dict[str, Any]]:
    """Daily totals — trend chart feed."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return [
        {"day": today, "district": "Food & Cafe", "total": 45.20, "count": 2},
        {"day": today, "district": "Transport", "total": 28.00, "count": 1},
        {"day": today, "district": "Entertainment", "total": 15.99, "count": 1},
    ]


def get_guest_stats_anomalies(limit: int = 10) -> list[dict[str, Any]]:
    """Anomalous transactions — empty for demo."""
    return []


# ── Budgets (for guest: mock limits) ──────────────────────────────────────────

def get_guest_budgets() -> list[dict[str, Any]]:
    """예산 설정 — 데모용."""
    now = datetime.now(timezone.utc).strftime("%Y-%m")
    return [
        {"district": "Food & Cafe", "budget_type": "expense", "monthly_limit": 600.0, "period_month": now},
        {"district": "Entertainment", "budget_type": "expense", "monthly_limit": 150.0, "period_month": now},
        {"district": "Transport", "budget_type": "expense", "monthly_limit": 200.0, "period_month": now},
        {"district": "Shopping", "budget_type": "expense", "monthly_limit": 300.0, "period_month": now},
    ]
