"""
🧠 Aura Finance — Mock AI Engine  (2026 Financial AI Full-Stack Architecture)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This module provides MOCK implementations of every major financial AI capability
described in the 2026 AI roadmap.  Each function exposes the EXACT interface
that a production ML model would use — swap the mock body for a real model
without changing any caller code.

Module Map
─────────────────────────────────────────────ois─────────────────────────────────
 Module 1 · Transaction Classifier          → delegates to mock_classifier.py
            Interface for: XGBoost / LightGBM / Neural Network

 Module 2 · Anomaly & Fraud Detector        → rule-based z-score + velocity
            Interface for: Isolation Forest / Autoencoder / DQN-RL

 Module 3 · Portfolio Analyzer              → concentration + diversity metrics
            Interface for: Mean-Variance Opt / Deep BSDE / Black-Litterman

 Module 4 · Trend & Momentum Predictor      → moving-average + meta-labeling
            Interface for: GBM ensemble / Deep RL (A3C/PPO) / LSTM

 Module 5 · Risk Assessor  (XAI-enabled)   → VaR proxy + budget stress
            Interface for: Neural Network + SHAP / Grad-CAM

 Module 6 · AI Financial Advisor            → template-based NLP insights
            Interface for: Fine-tuned Gemini / GPT-4o RAG pipeline

All outputs are Pydantic models — fully serialisable to JSON for the frontend.
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# Shared types
# ─────────────────────────────────────────────────────────────────────────────

class RiskLevel(str, Enum):
    LOW      = "low"
    MODERATE = "moderate"
    HIGH     = "high"
    CRITICAL = "critical"


class TrendDirection(str, Enum):
    RISING   = "rising"
    FALLING  = "falling"
    STABLE   = "stable"
    VOLATILE = "volatile"


class AdviceType(str, Enum):
    SAVING      = "saving"
    INVESTMENT  = "investment"
    RISK_ALERT  = "risk_alert"
    OPPORTUNITY = "opportunity"
    ANOMALY     = "anomaly"
    GOAL        = "goal"


class AdvicePriority(str, Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"
    URGENT = "urgent"


# ─────────────────────────────────────────────────────────────────────────────
# Output schemas  (production-ready Pydantic models)
# ─────────────────────────────────────────────────────────────────────────────

class FeatureImportance(BaseModel):
    """XAI — feature importance breakdown (SHAP-style)."""
    feature: str
    value: float        = Field(description="Importance magnitude; clamped to [-1, 1] for display")
    direction: str      # "positive" | "negative"
    description: str


class AnomalyResult(BaseModel):
    """
    Module 2 output.
    Production replacement: Isolation Forest / Autoencoder / DQN alert policy.
    """
    is_anomaly: bool
    anomaly_score: float            = Field(ge=0.0, le=1.0, description="0 = normal, 1 = certain fraud")
    anomaly_type: Optional[str]     = None   # "velocity" | "amount_spike" | "new_merchant" | "geo_mismatch"
    confidence: float               = Field(ge=0.0, le=1.0)
    explanation: str
    xai_features: list[FeatureImportance] = Field(default_factory=list)
    recommended_action: str         = "none"   # "block" | "flag" | "review" | "none"


class ConcentrationMetric(BaseModel):
    """Herfindahl-Hirschman Index for portfolio/spending concentration."""
    category: str
    share: float        = Field(ge=0.0, le=1.0)
    amount: float
    count: int
    is_concentrated: bool


class PortfolioAnalysis(BaseModel):
    """
    Module 3 output.
    Production replacement: Mean-Variance Optimization / Deep BSDE.
    """
    portfolio_score: float          = Field(ge=0.0, le=100.0, description="0 = worst, 100 = ideal")
    diversification_score: float    = Field(ge=0.0, le=1.0)
    hhi_index: float                = Field(ge=0.0, le=1.0, description="Herfindahl-Hirschman Index: 0=diverse, 1=monopoly")
    top_concentrations: list[ConcentrationMetric]
    total_invested: float
    estimated_monthly_expense: float
    savings_rate: Optional[float]   = None  # (income - expense) / income
    recommendations: list[str]
    risk_level: RiskLevel


class TrendSignal(BaseModel):
    """Single trend signal (like a GBM weak learner output)."""
    signal_name: str
    value: float
    weight: float
    direction: TrendDirection
    description: str


class TrendPrediction(BaseModel):
    """
    Module 4 output.
    Production replacement: GBM ensemble + DRL (A3C/PPO) timing strategy.
    Meta-Labeling: primary signal + secondary confidence filter.
    """
    category: str
    direction: TrendDirection
    momentum_score: float           = Field(ge=-1.0, le=1.0, description="-1 = hard falling, +1 = hard rising")
    predicted_change_pct: float     = Field(description="Estimated % change next period")
    confidence: float               = Field(ge=0.0, le=1.0)
    signals: list[TrendSignal]      = Field(default_factory=list)
    meta_label_confidence: float    = Field(ge=0.0, le=1.0, description="Secondary filter confidence (meta-labeling)")
    position_size_suggestion: str   = "hold"   # "increase" | "decrease" | "hold" | "exit"
    explanation: str


class RiskFactor(BaseModel):
    """Individual risk factor with XAI attribution."""
    name: str
    severity: RiskLevel
    score: float        = Field(ge=0.0, le=1.0)
    value: Any
    threshold: Any
    shap_value: float   = Field(description="SHAP-style contribution")  # unbounded; higher = more influential
    mitigation: str


class RiskAssessment(BaseModel):
    """
    Module 5 output.
    Production replacement: Neural Network + SHAP / Grad-CAM.
    """
    overall_risk_score: float       = Field(ge=0.0, le=100.0)
    risk_level: RiskLevel
    var_estimate: float             = Field(description="Value-at-Risk (95% confidence, 1-month)")
    budget_utilization: float       = Field(ge=0.0, le=2.0, description=">1.0 means over budget")
    spending_velocity: float        = Field(description="Transactions per day (recent 7 days)")
    risk_factors: list[RiskFactor]
    xai_explanation: str
    stress_scenario: str            = ""   # What-if: "If spending continues, …"
    regulatory_flags: list[str]     = Field(default_factory=list)


class FinancialAdvice(BaseModel):
    """
    Module 6 output.
    Production replacement: Fine-tuned LLM (Gemini / GPT) + RAG pipeline.
    """
    id: str
    advice_type: AdviceType
    priority: AdvicePriority
    title: str
    body: str
    supporting_data: dict[str, Any] = Field(default_factory=dict)
    action_items: list[str]         = Field(default_factory=list)
    estimated_impact: Optional[str] = None   # "Save $120/month", "Reduce risk by 15%"
    confidence: float               = Field(ge=0.0, le=1.0)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    try:
        return statistics.stdev(values)
    except Exception:
        return 0.0


def _z_score(value: float, mean: float, std: float) -> float:
    if std < 1e-9:
        return 0.0
    return (value - mean) / std


# ─────────────────────────────────────────────────────────────────────────────
# Module 1 · Transaction Classifier
# (delegates to mock_classifier.py — L1-L5 ensemble)
# Interface: ready for sklearn/XGBoost/LightGBM
# ─────────────────────────────────────────────────────────────────────────────

def classify_transaction(description: str, amount: Optional[float] = None):
    """
    Classify a bank transaction into a city district.
    Production replacement: XGBoost / LightGBM / Fine-tuned BERT.
    """
    from services.mock_classifier import mock_classify_transaction
    return mock_classify_transaction(description, amount)


# ─────────────────────────────────────────────────────────────────────────────
# Module 2 · Anomaly & Fraud Detector
# Mock:    statistical z-score + velocity + merchant frequency analysis
# Future:  Isolation Forest  →  Autoencoder  →  DQN alert policy (RL)
# ─────────────────────────────────────────────────────────────────────────────

def detect_anomaly(
    history: list[dict],          # recent transactions (desc, amount, timestamp, district)
    current: dict,                # transaction to evaluate
    sensitivity: float = 0.7,    # 0 = lenient, 1 = strict
) -> AnomalyResult:
    """
    Detect whether a transaction is anomalous.

    Mock algorithm (GBM-style feature engineering):
      F1  Amount z-score vs. category history
      F2  Velocity: transactions per minute in last 30 min
      F3  Merchant novelty: first time seen?
      F4  Amount spike vs. personal 90th-percentile threshold

    Production replacement:
      - Isolation Forest / One-class SVM  (unsupervised)
      - Autoencoder  (deep anomaly detection)
      - DQN alert policy (RL — learns optimal alert threshold per user)
    """
    desc     = current.get("description", "")
    amount   = abs(float(current.get("amount", 0)))
    district = current.get("district", "Unknown")
    ts       = float(current.get("timestamp", 0))

    # ── Feature extraction ────────────────────────────────────────────────────
    cat_amounts = [abs(float(t["amount"])) for t in history if t.get("district") == district]
    all_amounts = [abs(float(t["amount"])) for t in history]
    recent_30m  = [t for t in history if ts - float(t.get("timestamp", 0)) < 1800_000]
    merchant_count = sum(1 for t in history if t.get("description","").lower() == desc.lower())

    mean_cat   = statistics.mean(cat_amounts) if cat_amounts else amount
    std_cat    = _safe_std(cat_amounts)
    p90_all    = sorted(all_amounts)[int(len(all_amounts) * 0.9)] if all_amounts else amount * 2

    z_amount   = _z_score(amount, mean_cat, std_cat) if std_cat > 0 else 0.0
    velocity   = len(recent_30m)                           # tx count in last 30 min
    is_new_merchant = merchant_count == 0

    # ── Scoring (ensemble of weak learners) ──────────────────────────────────
    score = 0.0
    anomaly_type = None
    features: list[FeatureImportance] = []

    # F1: Amount z-score
    z_contrib = min(1.0, max(0.0, (z_amount - 1.5) / 3.0))
    if z_contrib > 0.1:
        score += z_contrib * 0.40
        features.append(FeatureImportance(
            feature="amount_z_score",
            value=round(min(z_contrib, 1.0), 3),
            direction="positive",
            description=f"Amount ${amount:.0f} is {z_amount:.1f}σ above category mean ${mean_cat:.0f}",
        ))
        if z_amount > 2.5:
            anomaly_type = "amount_spike"

    # F2: Velocity
    v_contrib = min(1.0, max(0.0, (velocity - 5) / 10.0))
    if v_contrib > 0.1:
        score += v_contrib * 0.30
        features.append(FeatureImportance(
            feature="velocity",
            value=round(v_contrib, 3),
            direction="positive",
            description=f"{velocity} transactions in last 30 min (normal <5)",
        ))
        if velocity > 8:
            anomaly_type = anomaly_type or "velocity"

    # F3: New merchant
    if is_new_merchant:
        score += 0.15
        features.append(FeatureImportance(
            feature="merchant_novelty",
            value=0.15,
            direction="positive",
            description=f"First transaction at '{desc[:40]}' — merchant not seen before",
        ))
        anomaly_type = anomaly_type or "new_merchant"

    # F4: Amount spike vs. personal p90
    if amount > p90_all * 1.5 and len(all_amounts) >= 5:
        spike = min(1.0, (amount / p90_all - 1.5) / 2.0)
        score += spike * 0.15
        features.append(FeatureImportance(
            feature="amount_vs_p90",
            value=round(spike, 3),
            direction="positive",
            description=f"${amount:.0f} exceeds personal 90th-percentile ${p90_all:.0f} by {amount/p90_all:.1f}x",
        ))

    # Calibrate by sensitivity
    threshold = 0.35 + (1 - sensitivity) * 0.25  # strict → lower threshold
    is_anomaly = score >= threshold
    confidence = min(0.97, 0.50 + score * 0.60) if is_anomaly else max(0.55, 1.0 - score * 1.5)

    action = "none"
    if score > 0.75:
        action = "block"
    elif score > 0.50:
        action = "flag"
    elif is_anomaly:
        action = "review"

    explanation = (
        f"Anomaly detected ({anomaly_type}): score {score:.2f} — "
        + "; ".join(f.description[:60] for f in features[:2])
    ) if is_anomaly else f"Normal transaction (score {score:.2f} < threshold {threshold:.2f})"

    return AnomalyResult(
        is_anomaly=is_anomaly,
        anomaly_score=round(min(score, 1.0), 3),
        anomaly_type=anomaly_type,
        confidence=round(confidence, 3),
        explanation=explanation,
        xai_features=features,
        recommended_action=action,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Module 3 · Portfolio Analyzer
# Mock:    HHI concentration + Sharpe-proxy + savings rate
# Future:  Mean-Variance Optimization / Deep BSDE (options pricing)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_portfolio(
    transactions: list[dict],
    income_total: float = 0.0,
    budget_limits: dict[str, float] | None = None,
) -> PortfolioAnalysis:
    """
    Analyse spending portfolio composition and risk.

    Mock algorithm:
      - Herfindahl-Hirschman Index (HHI) for concentration
      - Savings rate (income vs expense)
      - Diversification score

    Production replacement:
      - Mean-Variance Optimization (Markowitz)
      - Black-Litterman model (forward-looking)
      - Deep BSDE for high-dimensional risk surface
    """
    expense_txns = [t for t in transactions if t.get("type", "expense") == "expense"]
    by_category: dict[str, list[float]] = defaultdict(list)
    for t in expense_txns:
        cat = t.get("district") or t.get("classification", {}).get("district", "Unknown")
        by_category[cat].append(abs(float(t.get("amount", 0))))

    total = sum(a for amounts in by_category.values() for a in amounts)
    if total < 0.01:
        total = 1.0  # avoid division by zero

    # ── HHI concentration index ───────────────────────────────────────────────
    shares = {cat: sum(amts) / total for cat, amts in by_category.items()}
    hhi = sum(s ** 2 for s in shares.values())     # 0 = perfect diversity, 1 = monopoly
    diversification_score = max(0.0, 1.0 - hhi)

    # ── Category breakdown ───────────────────────────────────────────────────
    concentrations: list[ConcentrationMetric] = []
    for cat, amounts in sorted(by_category.items(), key=lambda x: -sum(x[1])):
        cat_total = sum(amounts)
        share = cat_total / total
        is_concentrated = share > 0.35  # >35% in one category = concentrated
        budget = (budget_limits or {}).get(cat, 0)
        concentrations.append(ConcentrationMetric(
            category=cat,
            share=round(share, 4),
            amount=round(cat_total, 2),
            count=len(amounts),
            is_concentrated=is_concentrated,
        ))

    # ── Savings rate ─────────────────────────────────────────────────────────
    savings_rate: Optional[float] = None
    if income_total > 0:
        savings_rate = max(-1.0, (income_total - total) / income_total)

    # ── Portfolio score (0-100) ───────────────────────────────────────────────
    score = 50.0
    score += diversification_score * 30     # up to +30 for diversification
    if savings_rate is not None:
        score += min(savings_rate, 0.4) * 50  # up to +20 for saving rate up to 40%
    score = max(0.0, min(100.0, score))

    # ── Risk level ────────────────────────────────────────────────────────────
    if hhi > 0.70 or (savings_rate is not None and savings_rate < -0.1):
        risk = RiskLevel.HIGH
    elif hhi > 0.40:
        risk = RiskLevel.MODERATE
    else:
        risk = RiskLevel.LOW

    # ── Recommendations ───────────────────────────────────────────────────────
    recs: list[str] = []
    top_cats = [c for c in concentrations if c.is_concentrated]
    if top_cats:
        recs.append(f"Reduce {top_cats[0].category} spend ({top_cats[0].share:.0%} of total) for better diversification.")
    if savings_rate is not None and savings_rate < 0.10:
        recs.append("Savings rate below 10% — consider reducing discretionary spend.")
    if hhi < 0.25:
        recs.append("Good diversification across categories. Maintain current balance.")
    if not recs:
        recs.append("Portfolio looks healthy. Review monthly to maintain balance.")

    return PortfolioAnalysis(
        portfolio_score=round(score, 1),
        diversification_score=round(diversification_score, 4),
        hhi_index=round(hhi, 4),
        top_concentrations=concentrations[:5],
        total_invested=round(total, 2),
        estimated_monthly_expense=round(total, 2),
        savings_rate=round(savings_rate, 4) if savings_rate is not None else None,
        recommendations=recs,
        risk_level=risk,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Module 4 · Trend & Momentum Predictor
# Mock:    Moving average cross + Z-score momentum + meta-labeling filter
# Future:  GBM ensemble / LSTM / Deep RL (A3C/PPO) for timing strategy
# ─────────────────────────────────────────────────────────────────────────────

def predict_spending_trend(
    transactions: list[dict],
    category: str,
    periods: int = 4,   # compare recent half vs earlier half
) -> TrendPrediction:
    """
    Predict whether spending in a category is rising, falling, or stable.

    Mock algorithm (Meta-Labeling style):
      Primary signal:   Moving average cross (fast MA > slow MA = rising)
      Secondary filter: Momentum z-score confirms or reduces confidence
                        → This is the Meta-Labeling "confidence filter"

    Production replacement:
      Primary model:  GBM ensemble (XGBoost + LightGBM)
      Meta-labeler:   Secondary classifier (Random Forest) filters signals
      Execution:      DRL agent (A3C/PPO) manages position sizing
    """
    cat_txns = sorted(
        [t for t in transactions
         if (t.get("district") or t.get("classification", {}).get("district","")) == category],
        key=lambda t: t.get("timestamp", 0),
    )

    if len(cat_txns) < 2:
        return TrendPrediction(
            category=category,
            direction=TrendDirection.STABLE,
            momentum_score=0.0,
            predicted_change_pct=0.0,
            confidence=0.30,
            signals=[],
            meta_label_confidence=0.30,
            position_size_suggestion="hold",
            explanation=f"Insufficient data for {category} trend prediction (< 2 transactions).",
        )

    amounts = [abs(float(t.get("amount", 0))) for t in cat_txns]
    n = len(amounts)
    mid = max(1, n // 2)
    recent_half   = amounts[mid:]
    earlier_half  = amounts[:mid]

    # Signal 1: Simple moving average cross
    fast_ma = statistics.mean(recent_half) if recent_half else 0
    slow_ma = statistics.mean(earlier_half) if earlier_half else fast_ma
    ma_cross = (fast_ma - slow_ma) / (slow_ma + 1e-9)   # relative change

    # Signal 2: Momentum (z-score of recent vs all)
    all_mean = statistics.mean(amounts)
    all_std  = _safe_std(amounts)
    recent_mean = statistics.mean(recent_half) if recent_half else all_mean
    momentum_z = _z_score(recent_mean, all_mean, all_std)

    # Signal 3: Acceleration (is trend speeding up?)
    if len(recent_half) >= 2:
        accel = (recent_half[-1] - recent_half[0]) / (len(recent_half) * (all_mean + 1e-9))
    else:
        accel = 0.0

    signals = [
        TrendSignal(
            signal_name="MA_cross",
            value=round(ma_cross, 4),
            weight=0.50,
            direction=TrendDirection.RISING if ma_cross > 0.05 else
                     TrendDirection.FALLING if ma_cross < -0.05 else TrendDirection.STABLE,
            description=f"Fast MA ${fast_ma:.0f} vs Slow MA ${slow_ma:.0f} ({ma_cross:+.1%})",
        ),
        TrendSignal(
            signal_name="momentum_z",
            value=round(momentum_z, 4),
            weight=0.35,
            direction=TrendDirection.RISING if momentum_z > 0.5 else
                     TrendDirection.FALLING if momentum_z < -0.5 else TrendDirection.STABLE,
            description=f"Recent spend {momentum_z:+.2f}σ from personal average",
        ),
        TrendSignal(
            signal_name="acceleration",
            value=round(accel, 4),
            weight=0.15,
            direction=TrendDirection.RISING if accel > 0.05 else
                     TrendDirection.FALLING if accel < -0.05 else TrendDirection.STABLE,
            description=f"Trend acceleration: {accel:+.2f}",
        ),
    ]

    # ── Ensemble: weighted momentum score ─────────────────────────────────────
    momentum_score = (
        math.tanh(ma_cross * 2.0) * 0.50 +
        math.tanh(momentum_z  * 0.5) * 0.35 +
        math.tanh(accel * 5.0) * 0.15
    )
    momentum_score = max(-1.0, min(1.0, momentum_score))

    # ── Meta-labeling: secondary confidence filter ─────────────────────────────
    # Agreement between signals boosts confidence; conflict reduces it
    signal_dirs = [s.direction for s in signals]
    main_dir = TrendDirection.RISING if momentum_score > 0.1 else \
               TrendDirection.FALLING if momentum_score < -0.1 else TrendDirection.STABLE
    agreement = sum(1 for d in signal_dirs if d == main_dir) / len(signal_dirs)
    meta_conf = 0.35 + agreement * 0.50 + abs(momentum_score) * 0.15
    meta_conf = min(0.95, meta_conf)

    # ── Predicted change ──────────────────────────────────────────────────────
    predicted_pct = momentum_score * 25.0  # mock: ±25% max prediction
    direction = (
        TrendDirection.RISING   if momentum_score > 0.15  else
        TrendDirection.FALLING  if momentum_score < -0.15 else
        TrendDirection.VOLATILE if _safe_std(amounts) / (all_mean + 1e-9) > 0.5 else
        TrendDirection.STABLE
    )

    # ── Position sizing (DRL-style output) ───────────────────────────────────
    if direction == TrendDirection.RISING and meta_conf > 0.65:
        position = "decrease"   # spend is rising → cut back
    elif direction == TrendDirection.FALLING and meta_conf > 0.65:
        position = "hold"       # spend is falling → maintain
    else:
        position = "hold"

    explanation = (
        f"{category} spend trend: {direction.value.upper()} "
        f"({predicted_pct:+.1f}% predicted). "
        f"Meta-label confidence {meta_conf:.0%}. "
        f"{'Signals agree — high confidence.' if agreement > 0.67 else 'Signals mixed — moderate confidence.'}"
    )

    return TrendPrediction(
        category=category,
        direction=direction,
        momentum_score=round(momentum_score, 4),
        predicted_change_pct=round(predicted_pct, 2),
        confidence=round(meta_conf, 3),
        signals=signals,
        meta_label_confidence=round(meta_conf, 3),
        position_size_suggestion=position,
        explanation=explanation,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Module 5 · Risk Assessor  (XAI-enabled)
# Mock:    Budget utilisation + velocity + VaR proxy + SHAP attribution
# Future:  Neural Network + SHAP / Grad-CAM explainability
# ─────────────────────────────────────────────────────────────────────────────

def assess_risk(
    transactions: list[dict],
    budget_limits: dict[str, float] | None = None,
    income_monthly: float = 0.0,
) -> RiskAssessment:
    """
    Holistic financial risk assessment with XAI attribution.

    Mock algorithm:
      - Budget utilisation per category (0–2.0 range)
      - Spending velocity (tx/day recent 7 days)
      - VaR proxy: 95th-percentile amount × recent velocity
      - Category concentration via HHI
      - SHAP-style feature attribution

    Production replacement:
      - Neural Network (tabular) for risk score
      - SHAP (TreeExplainer / DeepExplainer) for XAI
      - Grad-CAM for time-series attention maps
    """
    budget_limits = budget_limits or {}
    now_ts = max((t.get("timestamp", 0) for t in transactions), default=0) or 1e13
    week_ms = 7 * 24 * 3600 * 1000

    # Risk is computed on expense transactions only
    expense_txns = [t for t in transactions if t.get("type", "expense") == "expense"]
    recent_week  = [t for t in expense_txns if now_ts - float(t.get("timestamp", 0)) < week_ms]

    # ── Feature computation ────────────────────────────────────────────────────
    all_amounts = [abs(float(t.get("amount", 0))) for t in expense_txns]
    p95 = sorted(all_amounts)[int(len(all_amounts) * 0.95)] if len(all_amounts) >= 5 else max(all_amounts or [0])
    velocity = len(recent_week) / 7.0   # tx/day

    # Budget utilisation per category
    by_cat: dict[str, float] = defaultdict(float)
    for t in recent_week:
        cat = t.get("district") or t.get("classification", {}).get("district", "Unknown")
        by_cat[cat] += abs(float(t.get("amount", 0)))

    risk_factors: list[RiskFactor] = []

    # R1: Budget utilisation
    max_util = 0.0
    for cat, spent in by_cat.items():
        limit = budget_limits.get(cat, 0)
        if limit > 0:
            util = spent / limit
            max_util = max(max_util, util)
            if util > 0.70:
                sev = RiskLevel.CRITICAL if util > 1.0 else (RiskLevel.HIGH if util > 0.85 else RiskLevel.MODERATE)
                risk_factors.append(RiskFactor(
                    name=f"{cat}_budget_util",
                    severity=sev,
                    score=min(1.0, util),
                    value=round(spent, 2),
                    threshold=round(limit, 2),
                    shap_value=round(min(util - 0.7, 0.3) * 2.0, 3),
                    mitigation=f"Reduce {cat} spending by ${max(0, spent - limit * 0.8):.0f} to reach 80% utilisation.",
                ))

    # R2: Velocity risk
    if velocity > 5:
        v_score = min(1.0, (velocity - 5) / 10.0)
        risk_factors.append(RiskFactor(
            name="spending_velocity",
            severity=RiskLevel.HIGH if velocity > 10 else RiskLevel.MODERATE,
            score=round(v_score, 3),
            value=round(velocity, 2),
            threshold=5.0,
            shap_value=round(v_score * 0.4, 3),
            mitigation=f"Reduce transaction frequency ({velocity:.1f}/day). Consider weekly consolidated purchases.",
        ))

    # R3: Large amount risk
    p90 = sorted(all_amounts)[int(len(all_amounts) * 0.90)] if len(all_amounts) >= 5 else 0
    recent_large = [t for t in recent_week if abs(float(t.get("amount", 0))) > p90 * 1.5]
    if recent_large:
        large_score = min(1.0, len(recent_large) / 5.0)
        risk_factors.append(RiskFactor(
            name="large_transaction_frequency",
            severity=RiskLevel.MODERATE,
            score=round(large_score, 3),
            value=len(recent_large),
            threshold=2,
            shap_value=round(large_score * 0.3, 3),
            mitigation=f"{len(recent_large)} transactions exceeded 1.5× personal 90th percentile this week.",
        ))

    # R4: Income coverage
    if income_monthly > 0:
        expense_monthly = sum(by_cat.values()) * (30 / 7)  # normalise to month
        coverage = expense_monthly / income_monthly
        if coverage > 0.70:
            risk_factors.append(RiskFactor(
                name="income_expense_ratio",
                severity=RiskLevel.HIGH if coverage > 0.90 else RiskLevel.MODERATE,
                score=min(1.0, coverage),
                value=round(coverage, 3),
                threshold=0.70,
                shap_value=round((coverage - 0.7) * 0.8, 3),
                mitigation=f"Expenses at {coverage:.0%} of income. Target below 70% for healthy savings.",
            ))

    # ── Overall risk score ────────────────────────────────────────────────────
    if risk_factors:
        raw_score = sum(f.shap_value for f in risk_factors if f.shap_value > 0)
        risk_score = min(100.0, raw_score * 100 / max(len(risk_factors), 1) + 30)
    else:
        risk_score = 20.0   # baseline risk even with no flags

    risk_level = (
        RiskLevel.CRITICAL if risk_score >= 80 else
        RiskLevel.HIGH     if risk_score >= 60 else
        RiskLevel.MODERATE if risk_score >= 35 else
        RiskLevel.LOW
    )

    # ── VaR proxy (95% confidence) ────────────────────────────────────────────
    var_estimate = p95 * velocity * 7  # worst-case weekly exposure

    # ── Budget utilisation summary ────────────────────────────────────────────
    avg_util = statistics.mean(
        [abs(float(t.get("amount",0))) / budget_limits[t.get("district","")]
         for t in recent_week
         if budget_limits.get(t.get("district",""), 0) > 0]
    ) if any(budget_limits.get(t.get("district",""), 0) > 0 for t in recent_week) else 0.0

    xai_explanation = (
        f"Risk score {risk_score:.0f}/100 ({risk_level.value.upper()}). "
        + "Top factors: " + ", ".join(f.name for f in sorted(risk_factors, key=lambda x: -x.shap_value)[:3])
        if risk_factors else f"Risk score {risk_score:.0f}/100. No significant risk factors detected."
    )

    stress = (
        f"If spending continues at current velocity ({velocity:.1f} tx/day), "
        f"estimated monthly exposure: ${velocity * 30 * statistics.mean(all_amounts or [0]):.0f}."
    ) if all_amounts else ""

    return RiskAssessment(
        overall_risk_score=round(risk_score, 1),
        risk_level=risk_level,
        var_estimate=round(var_estimate, 2),
        budget_utilization=round(max_util, 3),
        spending_velocity=round(velocity, 2),
        risk_factors=sorted(risk_factors, key=lambda f: -f.shap_value),
        xai_explanation=xai_explanation,
        stress_scenario=stress,
        regulatory_flags=[],   # Future: AML / KYC flags
    )


# ─────────────────────────────────────────────────────────────────────────────
# Module 6 · AI Financial Advisor
# Mock:    Rule-triggered template-based insights
# Future:  Fine-tuned Gemini/GPT with RAG (transaction history as context)
# ─────────────────────────────────────────────────────────────────────────────

def generate_financial_advice(
    transactions: list[dict],
    portfolio: PortfolioAnalysis | None = None,
    risk: RiskAssessment | None = None,
    budget_limits: dict[str, float] | None = None,
    income_monthly: float = 0.0,
    max_advice: int = 5,
) -> list[FinancialAdvice]:
    """
    Generate prioritised financial advice from transaction patterns.

    Mock algorithm:
      Rule-based triggers mapped to structured advice templates.
      Confidence weighted by signal strength.

    Production replacement:
      - Retrieval-Augmented Generation (RAG):
          User history → embeddings → vector search → relevant context
      - Fine-tuned LLM (Gemini 2.0 / GPT-4o) generates personalised advice
      - Output validated against Pydantic schema for type safety
    """
    advices: list[FinancialAdvice] = []
    now_ts = max((t.get("timestamp", 0) for t in transactions), default=0) or 1e13
    week_ms = 7 * 24 * 3600 * 1000
    month_ms = 30 * 24 * 3600 * 1000

    expense_txns = [t for t in transactions if t.get("type", "expense") == "expense"]
    recent_month = [t for t in expense_txns if now_ts - float(t.get("timestamp", 0)) < month_ms]

    by_cat_month: dict[str, float] = defaultdict(float)
    by_cat_count: dict[str, int]   = defaultdict(int)
    for t in recent_month:
        cat = t.get("district") or t.get("classification", {}).get("district", "Unknown")
        by_cat_month[cat] += abs(float(t.get("amount", 0)))
        by_cat_count[cat] += 1

    total_month = sum(by_cat_month.values())

    # ── Advice trigger 1: Budget over-utilisation ─────────────────────────────
    if budget_limits:
        for cat, limit in budget_limits.items():
            spent = by_cat_month.get(cat, 0)
            util = spent / limit if limit > 0 else 0
            if util > 0.85:
                priority = AdvicePriority.URGENT if util > 1.0 else AdvicePriority.HIGH
                advices.append(FinancialAdvice(
                    id=f"budget_{cat}_{int(now_ts)}",
                    advice_type=AdviceType.RISK_ALERT,
                    priority=priority,
                    title=f"{cat} Budget {'Exceeded' if util > 1 else 'Near Limit'}",
                    body=(
                        f"Your {cat} spending this month is ${spent:.0f}, "
                        f"{'exceeding' if util > 1 else 'at'} {util:.0%} of your ${limit:.0f} budget. "
                        f"{'Immediate action recommended.' if util > 1 else 'You have $' + f'{limit-spent:.0f} remaining.'}"
                    ),
                    supporting_data={"spent": round(spent, 2), "budget": limit, "utilisation": round(util, 3)},
                    action_items=[
                        f"Review {cat} transactions this month",
                        f"Pause non-essential {cat} purchases for {int((util-0.9)*30) if util > 0.9 else 3} days",
                    ],
                    estimated_impact=f"Save ${max(0, spent - limit * 0.80):.0f} by reducing to 80% utilisation",
                    confidence=0.92,
                ))

    # ── Advice trigger 2: High category concentration ─────────────────────────
    if total_month > 0:
        for cat, spent in sorted(by_cat_month.items(), key=lambda x: -x[1]):
            share = spent / total_month
            if share > 0.40 and cat not in ("Housing & Utility",):
                advices.append(FinancialAdvice(
                    id=f"concentration_{cat}_{int(now_ts)}",
                    advice_type=AdviceType.SAVING,
                    priority=AdvicePriority.MEDIUM,
                    title=f"High Concentration: {cat}",
                    body=(
                        f"{cat} accounts for {share:.0%} of your monthly spend (${spent:.0f}). "
                        f"Balanced spending across categories improves financial resilience."
                    ),
                    supporting_data={"category": cat, "share": round(share, 3), "amount": round(spent, 2)},
                    action_items=[
                        f"Set a sub-limit for {cat} at ${spent * 0.75:.0f}",
                        "Review recurring charges in this category",
                    ],
                    estimated_impact=f"Save ${spent * 0.25:.0f}/month by targeting 75% of current spend",
                    confidence=0.78,
                ))
                break  # only the top concentrated category

    # ── Advice trigger 3: Low savings rate ────────────────────────────────────
    if income_monthly > 0 and total_month > 0:
        savings_rate = (income_monthly - total_month) / income_monthly
        if savings_rate < 0.15:
            advices.append(FinancialAdvice(
                id=f"savings_rate_{int(now_ts)}",
                advice_type=AdviceType.SAVING,
                priority=AdvicePriority.HIGH if savings_rate < 0.05 else AdvicePriority.MEDIUM,
                title="Savings Rate Below Target",
                body=(
                    f"Current savings rate: {savings_rate:.0%} "
                    f"(target: 15–20%). Monthly expenses ${total_month:.0f} "
                    f"vs income ${income_monthly:.0f}. "
                    f"{'Spending exceeds income — urgent review needed.' if savings_rate < 0 else 'Small adjustments can improve long-term wealth.'}"
                ),
                supporting_data={
                    "savings_rate": round(savings_rate, 4),
                    "total_expense": round(total_month, 2),
                    "income": round(income_monthly, 2),
                },
                action_items=[
                    f"Identify ${(income_monthly * 0.15 - max(0, income_monthly - total_month)):.0f}/month in cuttable expenses",
                    "Set up automatic transfer of 10% income to savings",
                    "Review subscriptions and recurring charges",
                ],
                estimated_impact=f"Reaching 15% savings rate = ${income_monthly * 0.15:.0f}/month saved",
                confidence=0.85,
            ))

    # ── Advice trigger 4: Recurring subscription overload ─────────────────────
    ent_count = by_cat_count.get("Entertainment", 0)
    ent_spend = by_cat_month.get("Entertainment", 0)
    if ent_count >= 4 and ent_spend > 50:
        advices.append(FinancialAdvice(
            id=f"subscriptions_{int(now_ts)}",
            advice_type=AdviceType.OPPORTUNITY,
            priority=AdvicePriority.MEDIUM,
            title="Subscription Audit Opportunity",
            body=(
                f"You have {ent_count} entertainment transactions this month (${ent_spend:.0f}). "
                "Multiple streaming/gaming subscriptions often go unused. "
                "A quick audit could free up meaningful cash."
            ),
            supporting_data={"count": ent_count, "total": round(ent_spend, 2)},
            action_items=[
                "List all active subscriptions and last-used date",
                "Cancel services unused in the past 30 days",
                "Consider rotating subscriptions (1–2 active at a time)",
            ],
            estimated_impact=f"Cancel 2 unused services → save ${ent_spend * 0.3:.0f}/month",
            confidence=0.72,
        ))

    # ── Advice trigger 5: Investment opportunity ──────────────────────────────
    invest_txns = [t for t in transactions if t.get("type") == "investment"]
    if not invest_txns and income_monthly > 0 and total_month < income_monthly * 0.85:
        surplus = income_monthly - total_month
        advices.append(FinancialAdvice(
            id=f"invest_opp_{int(now_ts)}",
            advice_type=AdviceType.INVESTMENT,
            priority=AdvicePriority.MEDIUM,
            title="Investment Opportunity Detected",
            body=(
                f"You have an estimated ${surplus:.0f}/month surplus. "
                "No investment activity detected. Consider allocating 50% of surplus "
                "to diversified index funds (e.g. S&P 500 ETF) for long-term wealth building."
            ),
            supporting_data={"surplus": round(surplus, 2), "suggested_invest": round(surplus * 0.5, 2)},
            action_items=[
                f"Invest ${surplus * 0.5:.0f}/month into low-cost index fund",
                "Set up automatic monthly investment (dollar-cost averaging)",
                "Keep 3–6 months expenses as emergency fund before investing",
            ],
            estimated_impact=f"${surplus * 0.5:.0f}/month invested × 10 years at 8% avg = ${surplus * 0.5 * 12 * 14.49:.0f}",
            confidence=0.68,
        ))

    # ── Advice trigger 6: Anomaly / high-risk transactions ───────────────────
    if risk and risk.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
        advices.append(FinancialAdvice(
            id=f"risk_alert_{int(now_ts)}",
            advice_type=AdviceType.ANOMALY,
            priority=AdvicePriority.URGENT if risk.risk_level == RiskLevel.CRITICAL else AdvicePriority.HIGH,
            title=f"Risk Alert: {risk.risk_level.value.title()} Financial Risk",
            body=risk.xai_explanation,
            supporting_data={"risk_score": risk.overall_risk_score, "risk_level": risk.risk_level.value},
            action_items=[f.mitigation for f in risk.risk_factors[:3]],
            estimated_impact="Addressing top risks could reduce risk score by 30–40%",
            confidence=0.88,
        ))

    # Sort by priority and return top N
    priority_order = {
        AdvicePriority.URGENT: 0, AdvicePriority.HIGH: 1,
        AdvicePriority.MEDIUM: 2, AdvicePriority.LOW: 3,
    }
    advices.sort(key=lambda a: priority_order.get(a.priority, 3))
    return advices[:max_advice]


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: run full AI analysis pipeline
# ─────────────────────────────────────────────────────────────────────────────

class FullAnalysisResult(BaseModel):
    """Complete AI analysis result from all 6 modules."""
    portfolio:   PortfolioAnalysis
    risk:        RiskAssessment
    trends:      list[TrendPrediction]
    advice:      list[FinancialAdvice]
    anomalies:   list[AnomalyResult]
    analysed_at: str


def run_full_analysis(
    transactions: list[dict],
    budget_limits: dict[str, float] | None = None,
    income_monthly: float = 0.0,
    top_categories: int = 3,
) -> FullAnalysisResult:
    """
    Run the complete 6-module AI pipeline in one call.
    Returns a fully structured analysis ready for the frontend dashboard.
    """
    budget_limits = budget_limits or {}

    # Module 3: Portfolio
    portfolio = analyze_portfolio(transactions, income_monthly, budget_limits)

    # Module 5: Risk
    risk = assess_risk(transactions, budget_limits, income_monthly)

    # Module 4: Trends for top categories
    top_cats = [c.category for c in portfolio.top_concentrations[:top_categories]]
    trends = [predict_spending_trend(transactions, cat) for cat in top_cats]

    # Module 6: AI Advice
    advice = generate_financial_advice(
        transactions, portfolio, risk, budget_limits, income_monthly
    )

    # Module 2: Anomaly check on recent transactions
    recent = sorted(transactions, key=lambda t: -float(t.get("timestamp", 0)))[:10]
    history = transactions
    anomalies = [detect_anomaly(history, tx) for tx in recent if detect_anomaly(history, tx).is_anomaly]

    return FullAnalysisResult(
        portfolio=portfolio,
        risk=risk,
        trends=trends,
        advice=advice,
        anomalies=anomalies,
        analysed_at=datetime.utcnow().isoformat() + "Z",
    )
