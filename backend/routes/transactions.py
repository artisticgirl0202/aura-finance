"""
Aura Finance — Transactions REST API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Endpoints:
  POST   /api/v1/transactions/classify-and-save
         Classify + persist a single transaction in one call.

  POST   /api/v1/transactions/batch-classify-and-save
         Classify + persist N transactions, 1 Gemini call (quota-friendly).

  GET    /api/v1/transactions
         Paginated list with filters (type, district, search, anomaly…).

  GET    /api/v1/transactions/{tx_id}
         Single transaction detail.

  GET    /api/v1/transactions/stats/by-district
         Spending totals per district → Dashboard pie chart feed.

  GET    /api/v1/transactions/stats/time-series
         Daily totals → trend charts / Module 4 feed.

  GET    /api/v1/transactions/stats/anomalies
         Recent anomalous transactions → Module 2 feed.

  GET    /api/v1/transactions/analysis/full
         Run the complete 6-module AI pipeline (M1-M6) on stored data.

  POST   /api/v1/budgets
         Save / update a budget limit.

  GET    /api/v1/budgets
         Retrieve all budget records for the current user.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import status

from database import get_db
from database.crud import (
    _tx_to_dict,
    cache_get,
    cache_set,
    create_transaction,
    create_transactions_bulk,
    get_budgets,
    get_transaction,
    list_transactions,
    stats_anomaly_summary,
    stats_by_district,
    stats_time_series,
    upsert_budget,
)
from services.auth_service import get_optional_user_id
from services.guest_mock_data import (
    get_guest_budgets,
    get_guest_stats_anomalies,
    get_guest_stats_by_district,
    get_guest_stats_time_series,
    get_guest_transactions,
)
from services.ai_classifier import batch_classify, classify_transaction
from services.mock_ai_engine import run_full_analysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["transactions"])


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class TxInput(BaseModel):
    description: str
    amount:      float = 0.0
    currency:    str   = "USD"
    tx_type:     str   = "expense"
    source:      str   = "manual"
    tink_id:     Optional[str] = None
    user_id:     Optional[str] = None
    tx_timestamp: Optional[str] = None   # ISO-8601


class TxResponse(BaseModel):
    id:            str
    description:   str
    amount:        float
    currency:      str
    type:          str
    district:      str
    confidence:    float
    reason:        Optional[str]
    icon:          Optional[str]
    color:         Optional[str]
    ai_engine:     Optional[str]
    source:        str
    is_anomaly:    bool
    anomaly_score: Optional[float]
    anomaly_type:  Optional[str]
    tx_timestamp:  Optional[str]
    created_at:    Optional[str]


class BudgetInput(BaseModel):
    district:     str
    budget_type:  str   = "expense"
    monthly_limit: float
    period_month: str   = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m"))
    user_id:      str   = "default"


# ─────────────────────────────────────────────────────────────────────────────
# Classify + save (single)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/transactions/classify-and-save", response_model=TxResponse)
async def classify_and_save(
    payload: TxInput,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Classify a transaction with AI and immediately persist it to the DB.
    Use this for real-time single transactions (e.g. WebSocket simulation).
    게스트: 403 Read-only.
    """
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to add transactions.",
        )
    # 1. Classify
    clf = await classify_transaction(
        description=payload.description,
        amount=payload.amount,
    )

    # 2. Anomaly detection on the fly (uses empty history for standalone calls)
    from services.mock_ai_engine import detect_anomaly
    anomaly = detect_anomaly([], {
        "description": payload.description,
        "amount": payload.amount,
        "district": clf.district,
        "timestamp": datetime.now(timezone.utc).timestamp() * 1000,
    })

    # 3. Parse optional timestamp
    tx_ts = None
    if payload.tx_timestamp:
        try:
            tx_ts = datetime.fromisoformat(payload.tx_timestamp.replace("Z", "+00:00"))
        except Exception:
            pass

    # 4. Persist
    record = await create_transaction(
        db,
        description=payload.description,
        amount=payload.amount,
        currency=payload.currency,
        tx_type=payload.tx_type,
        district=clf.district,
        confidence=clf.confidence,
        reason=clf.reason,
        icon=clf.icon,
        color=clf.color,
        ai_engine=getattr(clf, "ai_engine", "mock"),
        source=payload.source,
        tink_transaction_id=payload.tink_id,
        user_id=payload.user_id,
        tx_timestamp=tx_ts,
        anomaly_score=anomaly.anomaly_score,
        is_anomaly=anomaly.is_anomaly,
        anomaly_type=anomaly.anomaly_type,
    )
    return TxResponse(**_tx_to_dict(record))


# ─────────────────────────────────────────────────────────────────────────────
# Classify + save (batch)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/transactions/batch-classify-and-save", response_model=list[TxResponse])
async def batch_classify_and_save(
    payload: list[TxInput],
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Classify N transactions in ONE Gemini call, then bulk-insert to DB.
    Use for Tink bank import (100 transactions → 1 API call → 1 DB write).
    게스트: 403 Read-only.
    """
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to add transactions.",
        )
    if not payload:
        return []
    if len(payload) > 200:
        raise HTTPException(400, "Maximum 200 transactions per batch")

    # 1. Batch classify (1 Gemini call for all uncached items)
    descriptions = [p.description for p in payload]
    amounts      = [p.amount      for p in payload]
    clf_results  = await batch_classify(descriptions, amounts)

    if len(clf_results) != len(payload):
        raise HTTPException(500, "Classification count mismatch")

    # 2. Build bulk insert dicts
    records_data = []
    for p, clf in zip(payload, clf_results):
        tx_ts = None
        if p.tx_timestamp:
            try:
                tx_ts = datetime.fromisoformat(p.tx_timestamp.replace("Z", "+00:00"))
            except Exception:
                pass

        records_data.append(dict(
            description=p.description,
            amount=p.amount,
            currency=p.currency,
            tx_type=p.tx_type,
            district=clf.district,
            confidence=clf.confidence,
            reason=clf.reason,
            icon=clf.icon,
            color=clf.color,
            ai_engine=getattr(clf, "ai_engine", "mock"),
            source=p.source,
            tink_transaction_id=p.tink_id,
            user_id=p.user_id,
            tx_timestamp=tx_ts or datetime.now(timezone.utc),
            is_anomaly=False,
        ))

    # 3. Bulk insert
    saved = await create_transactions_bulk(db, records_data)
    logger.info(f"✅ Batch classify+save: {len(saved)} transactions stored")
    return [TxResponse(**_tx_to_dict(r)) for r in saved]


# ─────────────────────────────────────────────────────────────────────────────
# List transactions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/transactions")
async def list_tx(
    user_id:    Optional[str]  = Query(None),
    tx_type:    Optional[str]  = Query(None, description="expense | income | investment"),
    district:   Optional[str]  = Query(None),
    source:     Optional[str]  = Query(None),
    is_anomaly: Optional[bool] = Query(None),
    search:     Optional[str]  = Query(None, description="Search in description"),
    limit:      int            = Query(50,   ge=1, le=200),
    offset:     int            = Query(0,    ge=0),
    order_by:   str            = Query("desc"),
    auth_user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated transaction list with powerful filters.
    Perfect for the Dashboard recent-transactions feed and search feature.
    게스트: Mock 거래 목록 반환.
    """
    if auth_user_id == "guest":
        data = get_guest_transactions(limit=limit)
        return {"total": len(data), "limit": limit, "offset": offset, "data": data}
    try:
        records, total = await list_transactions(
            db,
            user_id=user_id,
            tx_type=tx_type,
            district=district,
            source=source,
            is_anomaly=is_anomaly,
            search=search,
            limit=limit,
            offset=offset,
            order_by=order_by,
        )
        return {
            "total":  total,
            "limit":  limit,
            "offset": offset,
            "data":   [_tx_to_dict(r) for r in records],
        }
    except Exception as e:
        logger.exception("list_tx failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "transaction_list_failed",
                "message": str(e),
                "hint": "Check DB schema matches model (e.g. bank_connection_id); see server logs for details.",
            },
        )


@router.get("/transactions/{tx_id}")
async def get_tx(tx_id: str, db: AsyncSession = Depends(get_db)):
    record = await get_transaction(db, tx_id)
    if not record:
        raise HTTPException(404, f"Transaction {tx_id} not found")
    return _tx_to_dict(record)


# ─────────────────────────────────────────────────────────────────────────────
# Stats / analytics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/transactions/stats/by-district")
async def stats_district(
    user_id:     Optional[str] = Query(None),
    tx_type:     str           = Query("expense"),
    auth_user_id: str          = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Spending totals grouped by district.
    Feeds: Dashboard pie chart · Portfolio analysis (Module 3) · 3D building heights.
    게스트: Mock 통계 반환.
    """
    if auth_user_id == "guest":
        return get_guest_stats_by_district(tx_type=tx_type)
    return await stats_by_district(db, user_id=user_id, tx_type=tx_type)


@router.get("/transactions/stats/time-series")
async def stats_ts(
    user_id:      Optional[str] = Query(None),
    district:     Optional[str] = Query(None),
    days:         int          = Query(30, ge=1, le=365),
    auth_user_id: str          = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily spending totals for trend charts.
    Feeds: Module 4 Trend Predictor · Line charts · 3D animations.
    게스트: Mock 시계열 반환.
    """
    if auth_user_id == "guest":
        return get_guest_stats_time_series(days=days)
    return await stats_time_series(db, user_id=user_id, district=district, days=days)


@router.get("/transactions/stats/anomalies")
async def stats_anomalies(
    user_id:      Optional[str] = Query(None),
    limit:        int           = Query(10, ge=1, le=50),
    auth_user_id: str           = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Top anomalous transactions by anomaly score.
    Feeds: Module 2 Fraud Detector · InsightToast alerts.
    게스트: 빈 목록 반환.
    """
    if auth_user_id == "guest":
        return get_guest_stats_anomalies(limit=limit)
    return await stats_anomaly_summary(db, user_id=user_id, limit=limit)


# ─────────────────────────────────────────────────────────────────────────────
# Full AI pipeline analysis (M1-M6)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/transactions/analysis/full")
async def full_analysis(
    user_id:         Optional[str]   = Query(None),
    income_monthly:  float           = Query(0.0),
    limit:           int             = Query(200, ge=1, le=1000),
    auth_user_id:    str             = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Run the complete 6-module AI pipeline on stored transaction history.

    Returns:
      portfolio   (Module 3 — concentration, savings rate, HHI)
      risk        (Module 5 — VaR, budget utilisation, XAI)
      trends      (Module 4 — momentum, meta-labeling)
      advice      (Module 6 — personalised AI advice)
      anomalies   (Module 2 — fraud / anomaly flags)

    게스트: Mock 데이터로 파이프라인 실행.
    """
    if auth_user_id == "guest":
        import time
        guest_tx = get_guest_transactions(limit)
        tx_dicts = [
            {
                "description": t["description"],
                "amount": t["amount"],
                "district": t["district"],
                "type": t["type"],
                "timestamp": int(time.time() * 1000) - (i + 1) * 86400000,
            }
            for i, t in enumerate(guest_tx)
        ]
        budget_records = get_guest_budgets()
        budget_limits = {b["district"]: b["monthly_limit"] for b in budget_records}
        result = run_full_analysis(
            tx_dicts, budget_limits=budget_limits, income_monthly=income_monthly or 6050.0
        )
        return result.model_dump()
    records, _ = await list_transactions(
        db,
        user_id=user_id,
        limit=limit,
        order_by="desc",
    )

    if not records:
        raise HTTPException(404, "No transactions found. Add transactions first.")

    # Convert ORM records → plain dicts for mock_ai_engine
    tx_dicts = [
        {
            "description": r.description,
            "amount":      r.amount,
            "district":    r.district,
            "type":        r.tx_type,
            "timestamp":   r.tx_timestamp.timestamp() * 1000 if r.tx_timestamp else 0,
        }
        for r in records
    ]

    # Fetch budget limits for this user/current month
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    budget_records = await get_budgets(db, user_id=user_id or "default", period_month=current_month)
    budget_limits = {b.district: b.monthly_limit for b in budget_records}

    result = run_full_analysis(
        tx_dicts,
        budget_limits=budget_limits,
        income_monthly=income_monthly,
    )
    return result.model_dump()


# ─────────────────────────────────────────────────────────────────────────────
# Budgets
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/budgets")
async def save_budget(
    payload: BudgetInput,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Create or update a monthly budget limit.
    Called by the BudgetPanel UI whenever the user changes a budget slider.
    게스트: 403 Read-only.
    """
    if user_id == "guest":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only in Guest Mode. Sign up or log in to save budgets.",
        )
    record = await upsert_budget(
        db,
        user_id=payload.user_id,
        district=payload.district,
        budget_type=payload.budget_type,
        monthly_limit=payload.monthly_limit,
        period_month=payload.period_month,
    )
    return {
        "id":            record.id,
        "district":      record.district,
        "budget_type":   record.budget_type,
        "monthly_limit": record.monthly_limit,
        "period_month":  record.period_month,
    }


@router.get("/budgets")
async def read_budgets(
    user_id:       str           = Query("default"),
    period_month:  Optional[str]  = Query(None),
    auth_user_id:  str            = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch budget limits — called on app startup to restore BudgetPanel state.
    게스트: Mock 예산 반환.
    """
    if auth_user_id == "guest":
        records = get_guest_budgets()
        return [
            {
                "district":      r["district"],
                "budget_type":   r["budget_type"],
                "monthly_limit": r["monthly_limit"],
                "period_month":  r["period_month"],
            }
            for r in records
        ]
    records = await get_budgets(db, user_id=user_id, period_month=period_month)
    return [
        {
            "district":      r.district,
            "budget_type":   r.budget_type,
            "monthly_limit": r.monthly_limit,
            "period_month":  r.period_month,
        }
        for r in records
    ]
