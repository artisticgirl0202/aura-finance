"""
Aura Finance — Stats Service (Phase 2: Data Visualization)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

통계학 기반 데이터 가공:
  • 카테고리별 지출 비율 (파이 차트용)
  • 지난달 대비 지출 변동성 (MoM)
  • 월별 시계열 (라인/영역 차트용)
  • 지출 변동성 (표준편차, 변동계수)

빈 데이터/예외 시에도 안전한 기본값 반환.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

# ── District → Chart Color (Cyan/Purple/Dark Blue 테마) ───────────────────────
DISTRICT_CHART_COLORS: dict[str, str] = {
    "Food & Cafe":       "#f59e0b",
    "Shopping":          "#ec4899",
    "Housing & Utility": "#3b82f6",
    "Entertainment":     "#8b5cf6",
    "Transport":         "#10b981",
    "Healthcare":        "#ef4444",
    "Education":         "#06b6d4",
    "Finance":           "#fbbf24",
    "Freelance":         "#34d399",
    "Rental Income":     "#a78bfa",
    "Salary":            "#10b981",
    "Side Income":       "#60a5fa",
    "Unknown":           "#6b7280",
}

DEFAULT_CHART_COLORS = ("#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#fbbf24")


def _tx_to_dict(r: Any) -> dict:
    """Convert ORM or dict to standard format."""
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
        if isinstance(raw, (int, float)):
            ts = float(raw)
        elif isinstance(raw, str):
            try:
                from datetime import datetime as dt
                ts = dt.fromisoformat(raw.replace("Z", "+00:00")).timestamp() * 1000
            except Exception:
                ts = 0

    cls = _get(r, "classification")
    district = _get(r, "district") or (cls.get("district", "Unknown") if isinstance(cls, dict) else "Unknown")
    district = str(district or "Unknown")

    return {
        "description": str(_get(r, "description") or ""),
        "amount": float(_get(r, "amount") or 0),
        "district": district,
        "type": str(_get(r, "tx_type") or _get(r, "type") or "expense"),
        "timestamp": ts,
    }


def _get_month_key(ts_ms: float) -> str:
    """Return YYYY-MM from timestamp in ms."""
    if ts_ms <= 0:
        return datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
        return dt.strftime("%Y-%m")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m")


def _color_for_district(name: str, index: int) -> str:
    return DISTRICT_CHART_COLORS.get(name, DEFAULT_CHART_COLORS[index % len(DEFAULT_CHART_COLORS)])


# ─────────────────────────────────────────────────────────────────────────────
# 1. 카테고리별 지출 분포 (파이/도넛 차트용)
# ─────────────────────────────────────────────────────────────────────────────

def get_category_spend_distribution(
    tx_records: list,
) -> list[dict[str, Any]]:
    """
    카테고리별 지출 비율 계산. Recharts PieChart/DonutChart 직접 사용 가능.
    Returns: [{ name, value, percent, color }, ...]
    """
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    by_cat: dict[str, float] = defaultdict(float)
    for t in tx_dicts:
        tx_type = t.get("type", "expense")
        amt = float(t.get("amount", 0))
        # expense: type 명시 또는 금액이 음수(월세 등 지출)
        is_expense = tx_type == "expense" or amt < 0
        if is_expense:
            cat = (t.get("district") or "Unknown").strip()
            by_cat[cat] += abs(amt)

    total = sum(by_cat.values())
    if total < 0.01:
        return []

    result: list[dict[str, Any]] = []
    for i, (name, value) in enumerate(sorted(by_cat.items(), key=lambda x: -x[1])):
        percent = (value / total) * 100
        result.append({
            "name": name,
            "value": round(value, 2),
            "percent": round(percent, 1),
            "color": _color_for_district(name, i),
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 2. 지난달 대비 지출 변동 (MoM)
# ─────────────────────────────────────────────────────────────────────────────

def get_month_over_month(
    tx_records: list,
) -> dict[str, Any]:
    """
    이번 달 vs 지난달 지출 비교.
    Returns: { this_month, last_month, change_pct, change_direction, this_income, last_income }
    """
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    now = datetime.now(timezone.utc)
    this_key = now.strftime("%Y-%m")
    if now.month == 1:
        last_key = f"{now.year - 1}-12"
    else:
        last_key = f"{now.year}-{now.month - 1:02d}"

    by_month_exp: dict[str, float] = defaultdict(float)
    by_month_inc: dict[str, float] = defaultdict(float)
    for t in tx_dicts:
        key = _get_month_key(t.get("timestamp", 0))
        amt = abs(float(t.get("amount", 0)))
        if t.get("type", "expense") == "expense":
            by_month_exp[key] += amt
        else:
            by_month_inc[key] += amt

    this_exp = by_month_exp.get(this_key, 0.0)
    last_exp = by_month_exp.get(last_key, 0.0)
    this_inc = by_month_inc.get(this_key, 0.0)
    last_inc = by_month_inc.get(last_key, 0.0)

    change_pct = 0.0
    change_direction = "stable"
    if last_exp > 0.01:
        change_pct = ((this_exp - last_exp) / last_exp) * 100
        change_direction = "rising" if change_pct > 2 else ("falling" if change_pct < -2 else "stable")
    elif this_exp > 0.01:
        change_direction = "rising"

    return {
        "this_month_expense": round(this_exp, 2),
        "last_month_expense": round(last_exp, 2),
        "change_pct": round(change_pct, 1),
        "change_direction": change_direction,
        "this_month_income": round(this_inc, 2),
        "last_month_income": round(last_inc, 2),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. 지출 변동성 (표준편차, 변동계수)
# ─────────────────────────────────────────────────────────────────────────────

def get_spending_volatility(
    tx_records: list,
    months: int = 3,
) -> dict[str, Any]:
    """
    최근 N개월 지출의 표준편차와 변동계수.
    높을수록 지출이 불규칙함 = 위험도 상승 지표.
    """
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    by_month: dict[str, float] = defaultdict(float)
    for t in tx_dicts:
        if t.get("type", "expense") == "expense":
            key = _get_month_key(t.get("timestamp", 0))
            by_month[key] += abs(float(t.get("amount", 0)))

    sorted_months = sorted(by_month.keys(), reverse=True)[:months]
    values = [by_month[k] for k in sorted_months]

    if len(values) < 2:
        return {
            "std_dev": 0.0,
            "mean": round(sum(values) / max(len(values), 1), 2),
            "coefficient_of_variation": 0.0,
            "volatility_level": "low",
            "months_analyzed": len(values),
        }

    mean_val = sum(values) / len(values)
    variance = sum((x - mean_val) ** 2 for x in values) / len(values)
    std_dev = math.sqrt(max(0, variance))
    cv = (std_dev / mean_val) * 100 if mean_val > 0.01 else 0.0

    # 변동계수 기준: <15% low, 15-30% moderate, >30% high
    vol_level = "high" if cv > 30 else ("moderate" if cv > 15 else "low")

    return {
        "std_dev": round(std_dev, 2),
        "mean": round(mean_val, 2),
        "coefficient_of_variation": round(cv, 1),
        "volatility_level": vol_level,
        "months_analyzed": len(values),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. 월별 시계열 (라인/영역 차트용)
# ─────────────────────────────────────────────────────────────────────────────

def get_monthly_timeseries(
    tx_records: list,
    months: int = 6,
) -> list[dict[str, Any]]:
    """
    최근 N개월 월별 수입/지출/잔고.
    Returns: [{ month, income, expense, balance }, ...] 오래된 순.
    """
    tx_dicts = [_tx_to_dict(r) for r in tx_records]
    by_month: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for t in tx_dicts:
        key = _get_month_key(t.get("timestamp", 0))
        amt = float(t.get("amount", 0))
        if t.get("type", "expense") == "expense":
            by_month[key]["expense"] += abs(amt)
        else:
            by_month[key]["income"] += amt

    # 최근 N개월만 (월 이름 포맷)
    all_keys = sorted(by_month.keys(), reverse=True)[:months]
    all_keys.reverse()  # 오래된 순

    result: list[dict[str, Any]] = []
    running_balance = 0.0
    for key in all_keys:
        data = by_month[key]
        inc = data["income"]
        exp = data["expense"]
        running_balance += inc - exp
        # "Jan 2025" 형태
        parts = key.split("-")
        try:
            from calendar import month_abbr
            month_label = f"{month_abbr[int(parts[1])]} {parts[0]}"
        except Exception:
            month_label = key
        result.append({
            "month": key,
            "month_label": month_label,
            "income": round(inc, 2),
            "expense": round(exp, 2),
            "balance": round(running_balance, 2),
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 5. 통합 요약 (한 번에 호출)
# ─────────────────────────────────────────────────────────────────────────────

def compute_stats_overview(
    tx_records: list,
    months_timeseries: int = 6,
    months_volatility: int = 3,
) -> dict[str, Any]:
    """
    모든 통계를 한 번에 계산. 빈 데이터 시에도 안전한 구조 반환.
    """
    if not tx_records:
        return {
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
        }

    return {
        "spending_distribution": get_category_spend_distribution(tx_records),
        "month_over_month": get_month_over_month(tx_records),
        "volatility": get_spending_volatility(tx_records, months=months_volatility),
        "monthly_trend": get_monthly_timeseries(tx_records, months=months_timeseries),
    }
