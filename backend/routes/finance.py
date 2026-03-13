"""
Aura Finance — Finance API (Phase 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

계좌 잔고, 최근 지출/수입 내역, 목표 진행률 연동.

Endpoints:
  GET /api/v1/finance/overview         — balance + recent transactions + goals with progress
  GET /api/v1/finance/balance         — account balance only
  GET /api/v1/finance/transactions/recent — recent income/expense list
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.auth_service import get_optional_user_id
from services.guest_mock_data import get_guest_finance_overview
from services.finance_service import (
    get_balance_from_transactions,
    get_finance_overview,
    get_recent_transactions,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/finance", tags=["finance"])


@router.get("/overview")
async def finance_overview(
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 1 핵심 엔드포인트: 잔고, 최근 거래, 목표별 진행률을 한 번에 반환.
    프론트엔드 목표 대시보드에서 진행률 바/카운트업 애니메이션에 사용.
    거래가 없으면 Mock 데이터로 데모 제공.
    게스트 모드: 실제 DB 없이 풍부한 Mock 데이터 반환.
    """
    try:
        if user_id == "guest":
            return get_guest_finance_overview()
        uid = user_id or "default"
        data = await get_finance_overview(db, uid)
        return data
    except Exception as e:
        logger.exception("Finance overview failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/balance")
async def get_balance(
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """유저의 계좌 잔고 (transactions 기준 계산)."""
    try:
        if user_id == "guest":
            return {"balance": get_guest_finance_overview()["balance"], "currency": "USD"}
        uid = user_id or "default"
        balance = await get_balance_from_transactions(db, uid)
        return {"balance": balance, "currency": "USD"}
    except Exception as e:
        logger.exception("Balance fetch failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions/recent")
async def recent_transactions(
    limit: int = Query(20, ge=1, le=100),
    use_mock: bool = Query(True, description="데이터 없을 때 Mock 사용"),
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """최근 지출/수입 내역. use_mock=true 시 데이터 없으면 Mock 반환."""
    try:
        if user_id == "guest":
            tx_list = get_guest_finance_overview()["recent_transactions"][:limit]
            return {"transactions": tx_list, "count": len(tx_list)}
        uid = user_id or "default"
        tx_list = await get_recent_transactions(db, uid, limit=limit, use_mock_if_empty=use_mock)
        return {"transactions": tx_list, "count": len(tx_list)}
    except Exception as e:
        logger.exception("Recent transactions failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
