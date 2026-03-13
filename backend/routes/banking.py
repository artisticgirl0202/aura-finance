"""
🏦 Banking API Routes

Tink Open Banking 연동 엔드포인트
- POST /connect: code → token 교환 → DB 저장 → 거래 조회 → AI 분류 → DB 저장 (통합 플로우)
- GET /transactions: 기존 단일 조회 (호환)
"""

import asyncio
import logging
import os
import random
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from database.crud import (
    create_bank_connection,
    create_transaction,
    create_transactions_bulk,
    get_active_bank_connection,
    get_transaction_by_tink_id,
    revoke_bank_connections_for_user,
)
from services.ai_classifier import batch_classify, classify_transaction
from services.auth_service import get_optional_user_id
from services.tink_service import tink_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/banking", tags=["Banking"])


# ==========================================
# Mock transactions (Tink 실패 시 fallback)
# ==========================================

_MOCK_MERCHANTS = [
    ("Starbucks Seoul", 3.5, 15.0), ("McDonald's", 5.0, 20.0), ("Whole Foods Market", 25.0, 150.0),
    ("Netflix", 9.99, 19.99), ("Amazon.com", 15.0, 200.0), ("Uber Trip", 8.0, 45.0),
    ("Shell Gas Station", 35.0, 85.0), ("CVS Pharmacy", 12.0, 80.0), ("Apple Store", 50.0, 1200.0),
    ("Salary Deposit", -3000.0, -8000.0), ("Bank Transfer In", -100.0, -5000.0),
]


def _generate_mock_transactions(count: int = 50) -> List[dict]:
    """Tink API 실패 시 사용할 목업 거래 데이터."""
    out = []
    now = datetime.now(timezone.utc)
    for i in range(count):
        desc, lo, hi = random.choice(_MOCK_MERCHANTS)
        amount = round(random.uniform(lo, hi), 2)
        unscaled = int(amount * 100)
        out.append({
            "id": f"mock_tx_{i}_{int(now.timestamp())}",
            "descriptions": {"display": desc, "original": desc},
            "amount": {"value": {"unscaledValue": unscaled, "scale": 2}, "currencyCode": "USD"},
            "dates": {"booked": (now - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d")},
            "accountId": "mock_account_1",
        })
    return out


def _generate_sync_mock_transactions(count: int = 3) -> List[dict]:
    """수동 동기화 시 데모/테스트용 최근 거래 2~3건 (최근 1~2일)."""
    out = []
    now = datetime.now(timezone.utc)
    for i in range(count):
        desc, lo, hi = random.choice(_MOCK_MERCHANTS)
        amount = round(random.uniform(lo, hi), 2)
        unscaled = int(amount * 100)
        days_ago = random.randint(0, 2)
        out.append({
            "id": f"sync_mock_{i}_{int(now.timestamp())}_{random.randint(1000, 9999)}",
            "descriptions": {"display": desc, "original": desc},
            "amount": {"value": {"unscaledValue": unscaled, "scale": 2}, "currencyCode": "USD"},
            "dates": {"booked": (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")},
            "accountId": "mock_account_1",
        })
    return out


# ==========================================
# Request/Response Models
# ==========================================

def _default_redirect_uri() -> str:
    return f"{os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')}/callback"


class ConnectRequest(BaseModel):
    """은행 연결 통합 요청 (code → token → 거래 조회 → DB 저장)"""
    code: str
    redirect_uri: str = Field(default_factory=_default_redirect_uri)


class ConnectResponse(BaseModel):
    """은행 연결 결과"""
    success: bool
    transaction_count: int
    message: str
    bank_connection_id: Optional[str] = None
    access_token: Optional[str] = None  # 프론트엔드 getAccounts용 (임시 표시)


class AuthLinkRequest(BaseModel):
    """인증 링크 생성 요청"""
    user_id: str
    redirect_uri: str = Field(default_factory=_default_redirect_uri)


class AuthLinkResponse(BaseModel):
    """인증 링크 응답"""
    auth_url: str
    user_id: str
    message: str


class TokenExchangeRequest(BaseModel):
    """토큰 교환 요청"""
    authorization_code: str
    redirect_uri: str = Field(default_factory=_default_redirect_uri)


class TokenResponse(BaseModel):
    """토큰 응답"""
    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    token_type: str


class AccountInfo(BaseModel):
    """계좌 정보"""
    id: str
    name: str
    type: str
    balance: float
    currency: str


class TransactionInfo(BaseModel):
    """거래 정보"""
    id: str
    description: str
    amount: float
    currency: str
    date: str
    category: Optional[str]
    account_id: str
    # AI 분류 결과
    ai_district: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_color: Optional[str] = None


# ==========================================
# Endpoints
# ==========================================

@router.post("/connect", response_model=ConnectResponse)
async def connect_bank_full(
    request: ConnectRequest,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    🔗 은행 연결 통합 플로우 (권장)
    1. code → access_token 교환
    2. bank_connections 테이블에 userId + token 저장
    3. Tink API로 거래 내역 조회 (실패 시 목업 데이터)
    4. AI 배치 분류
    5. transactions 테이블에 userId + bank_connection_id 연결 저장
    """
    uid = user_id or "default"

    try:
        # 1. Code → Token (run sync in executor to avoid blocking event loop)
        token_data = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: tink_service.exchange_code_for_token_sync(
                request.code, request.redirect_uri
            ),
        )
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")

        # 2. DB에 bank_connection 저장
        conn = await create_bank_connection(
            db,
            user_id=uid,
            access_token=access_token,
            refresh_token=refresh_token,
            tink_user_id=token_data.get("user_id"),
        )
        await db.commit()
        bank_conn_id = conn.id

        # 3. 거래 내역 조회 (Tink → 실패 시 목업)
        try:
            raw_txs = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: tink_service.get_transactions_sync(
                        access_token, None, 30
                    ),
                ),
                timeout=20.0,
            )
            logger.info(f"✅ Tink returned {len(raw_txs)} transactions")
        except Exception as tink_err:
            logger.warning(f"⚠ Tink transactions failed, using mock: {tink_err}")
            raw_txs = _generate_mock_transactions(50)

        if not raw_txs:
            return ConnectResponse(
                success=True,
                transaction_count=0,
                message="Bank connected. No transactions in the last 30 days.",
                bank_connection_id=bank_conn_id,
                access_token=access_token,
            )

        # 4. 파싱 및 AI 배치 분류
        descriptions = []
        amounts = []
        parsed = []
        for tx in raw_txs:
            descs = tx.get("descriptions", {})
            desc = (
                descs.get("display")
                or descs.get("original")
                or tx.get("merchantInformation", {}).get("merchantName")
                or tx.get("description")
                or "Unknown"
            )
            amt_obj = tx.get("amount", {}).get("value", {})
            unscaled = float(amt_obj.get("unscaledValue", 0))
            scale = int(amt_obj.get("scale", 2))
            amt = unscaled / (10 ** scale)
            currency = tx.get("amount", {}).get("currencyCode", "USD")
            date_str = tx.get("dates", {}).get("booked") or tx.get("date", "")
            parsed.append({
                "id": tx.get("id", ""),
                "description": desc,
                "amount": abs(amt),
                "currency": currency,
                "tx_type": "income" if amt < 0 else "expense",
                "date": date_str,
            })
            descriptions.append(desc)
            amounts.append(abs(amt))

        classifications = await batch_classify(descriptions, amounts)

        # 5. DB 저장 (중복 제거)
        saved = 0
        for p, cls in zip(parsed, classifications):
            # 이미 저장된 tink_id 건너뛰기
            if p["id"] and (await get_transaction_by_tink_id(db, p["id"])):
                continue
            await create_transaction(
                db,
                description=p["description"],
                amount=p["amount"],
                currency=p["currency"],
                tx_type=p["tx_type"],
                district=cls.district,
                confidence=cls.confidence,
                reason=cls.reason or "",
                icon=cls.icon or "circle",
                color=cls.color or "#6b7280",
                ai_engine=getattr(cls, "ai_engine", None) or "batch",
                source="tink",
                tink_transaction_id=p["id"] or None,
                user_id=uid,
                bank_connection_id=bank_conn_id,
                tx_timestamp=datetime.fromisoformat(p["date"]) if p["date"] else None,
            )
            saved += 1

        await db.commit()
        logger.info(f"✅ Saved {saved} bank transactions for user {uid}")

        return ConnectResponse(
            success=True,
            transaction_count=saved,
            message=f"Bank connected. {saved} transactions saved and classified.",
            bank_connection_id=bank_conn_id,
            access_token=access_token,
        )

    except Exception as e:
        logger.error(f"❌ Bank connect failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/link", response_model=AuthLinkResponse)
async def create_auth_link(request: AuthLinkRequest):
    """
    🔗 Tink 인증 링크 생성
    
    사용자가 은행 계좌를 연결하기 위한 Tink Link URL을 생성합니다.
    
    **Flow:**
    1. 프론트엔드에서 이 API 호출
    2. Tink 임시 사용자 생성
    3. 인증 링크 생성 및 반환
    4. 사용자를 해당 링크로 리다이렉트
    """
    try:
        # 1. Tink 사용자 생성 (없으면)
        logger.info(f"Creating Tink user for: {request.user_id}")
        user_result = await tink_service.create_temporary_user(
            external_user_id=request.user_id
        )

        tink_user_id = user_result.get("user_id")

        # 2. 인증 링크 생성
        logger.info(f"Generating auth link for Tink user: {tink_user_id}")
        auth_url = await tink_service.generate_auth_link(
            user_id=tink_user_id,
            redirect_uri=request.redirect_uri
        )

        return AuthLinkResponse(
            auth_url=auth_url,
            user_id=tink_user_id,
            message="Auth link created successfully. Redirect user to this URL."
        )

    except Exception as e:
        logger.error(f"❌ Failed to create auth link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/token", response_model=TokenResponse)
async def exchange_auth_code(request: TokenExchangeRequest):
    """
    🔐 인증 코드를 액세스 토큰으로 교환
    
    사용자가 은행 인증을 완료한 후, 콜백으로 받은 코드를 토큰으로 교환합니다.
    
    **Flow:**
    1. 사용자가 Tink Link에서 은행 인증 완료
    2. Tink가 redirect_uri로 authorization_code와 함께 리다이렉트
    3. 프론트엔드에서 이 API 호출
    4. 액세스 토큰 반환
    """
    try:
        logger.info("Exchanging authorization code for token")
        token_data = await tink_service.exchange_code_for_token(
            authorization_code=request.authorization_code,
            redirect_uri=request.redirect_uri
        )

        return TokenResponse(
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            expires_in=token_data.get("expires_in", 3600),
            token_type=token_data.get("token_type", "Bearer")
        )

    except Exception as e:
        logger.error(f"❌ Failed to exchange code: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/accounts", response_model=List[AccountInfo])
async def get_user_accounts(
    access_token: str = Query(..., description="User access token from Tink")
):
    """
    💳 연결된 은행 계좌 목록 조회
    
    사용자가 연결한 모든 은행 계좌의 정보를 가져옵니다.
    """
    try:
        logger.info("Fetching user accounts")
        accounts = await tink_service.get_accounts(access_token)

        return [
            AccountInfo(
                id=acc["id"],
                name=acc.get("name", "Unknown Account"),
                type=acc.get("type", "CHECKING"),
                balance=float(acc.get("balance", {}).get("amount", {}).get("value", 0)),
                currency=acc.get("balance", {}).get("amount", {}).get("currencyCode", "USD")
            )
            for acc in accounts
        ]

    except Exception as e:
        logger.error(f"❌ Failed to get accounts: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/transactions", response_model=List[TransactionInfo])
async def get_user_transactions(
    access_token: str = Query(..., description="User access token from Tink"),
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    days: int = Query(30, description="Number of days to retrieve", ge=1, le=365),
    classify_with_ai: bool = Query(True, description="AI 분류 자동 실행")
):
    """
    📊 거래 내역 조회 + AI 자동 분류
    
    사용자의 실제 은행 거래 내역을 가져오고, AI로 자동 분류합니다.
    
    **이 데이터가 3D 도시에 실시간으로 표시됩니다!**
    """
    try:
        logger.info(f"Fetching transactions (last {days} days)")
        transactions = await tink_service.get_transactions(
            user_access_token=access_token,
            account_id=account_id,
            days=days
        )

        result = []

        for tx in transactions:
            # ── Tink v2 description field hierarchy ──────────────────────────
            # Tink returns descriptions as a nested object, NOT a top-level string.
            # Priority: display name → original text → merchant name → "Unknown"
            descs = tx.get("descriptions", {})
            description = (
                descs.get("display")
                or descs.get("original")
                or tx.get("merchantInformation", {}).get("merchantName")
                or tx.get("description")   # fallback for older API format
                or "Unknown"
            )

            # ── Amount: Tink v2 uses unscaledValue + scale ────────────────────
            amount_obj   = tx.get("amount", {}).get("value", {})
            unscaled     = float(amount_obj.get("unscaledValue", 0))
            scale        = int(amount_obj.get("scale", 2))
            amount       = unscaled / (10 ** scale)
            currency     = tx.get("amount", {}).get("currencyCode", "SEK")

            transaction_info = TransactionInfo(
                id=tx["id"],
                description=description,
                amount=abs(amount),
                currency=currency,
                date=tx.get("dates", {}).get("booked", ""),
                category=tx.get("types", {}).get("type"),
                account_id=tx.get("accountId", "")
            )

            # AI 분류 자동 실행
            if classify_with_ai and description:
                try:
                    classification = await classify_transaction(description)
                    transaction_info.ai_district = classification.district
                    transaction_info.ai_confidence = classification.confidence
                    transaction_info.ai_color = classification.color
                except Exception as e:
                    logger.warning(f"AI classification failed for {description}: {e}")

            result.append(transaction_info)

        logger.info(f"✅ Processed {len(result)} transactions")
        return result

    except Exception as e:
        logger.error(f"❌ Failed to get transactions: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync")
async def sync_bank_data(
    db: AsyncSession = Depends(get_db),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    ↻ 은행 데이터 수동 동기화
    - Tink 연결 시: 최신 거래 조회 → AI 분류 → DB 저장
    - 데모/미연동 시: 2~3건 목업 거래 생성 → AI 분류 → DB 저장
    """
    uid = user_id or "default"

    conn = await get_active_bank_connection(db, uid)
    raw_txs: List[dict] = []

    if conn and conn.access_token:
        try:
            raw_txs = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: tink_service.get_transactions_sync(
                        conn.access_token, None, 30
                    ),
                ),
                timeout=20.0,
            )
            logger.info(f"✅ Tink sync: {len(raw_txs)} transactions for user {uid[:8]}...")
        except Exception as tink_err:
            logger.warning(f"⚠ Tink sync failed, using mock: {tink_err}")
            raw_txs = _generate_sync_mock_transactions(random.randint(2, 3))

    if not raw_txs:
        raw_txs = _generate_sync_mock_transactions(random.randint(2, 3))

    # 파싱 및 AI 배치 분류
    descriptions = []
    amounts = []
    parsed = []
    for tx in raw_txs:
        descs = tx.get("descriptions", {})
        desc = (
            descs.get("display")
            or descs.get("original")
            or tx.get("merchantInformation", {}).get("merchantName")
            or tx.get("description")
            or "Unknown"
        )
        amt_obj = tx.get("amount", {}).get("value", {})
        unscaled = float(amt_obj.get("unscaledValue", 0))
        scale = int(amt_obj.get("scale", 2))
        amt = unscaled / (10 ** scale)
        currency = tx.get("amount", {}).get("currencyCode", "USD")
        date_str = tx.get("dates", {}).get("booked") or tx.get("date", "")
        parsed.append({
            "id": tx.get("id", ""),
            "description": desc,
            "amount": abs(amt),
            "currency": currency,
            "tx_type": "income" if amt < 0 else "expense",
            "date": date_str,
        })
        descriptions.append(desc)
        amounts.append(abs(amt))

    classifications = await batch_classify(descriptions, amounts)

    # DB 저장 (중복 제거)
    bank_conn_id = conn.id if conn else None
    saved = 0
    for p, cls in zip(parsed, classifications):
        if p["id"] and (await get_transaction_by_tink_id(db, p["id"])):
            continue
        await create_transaction(
            db,
            description=p["description"],
            amount=p["amount"],
            currency=p["currency"],
            tx_type=p["tx_type"],
            district=cls.district,
            confidence=cls.confidence,
            reason=cls.reason or "",
            icon=cls.icon or "circle",
            color=cls.color or "#6b7280",
            ai_engine=getattr(cls, "ai_engine", None) or "batch",
            source="tink",
            tink_transaction_id=p["id"] or None,
            user_id=uid,
            bank_connection_id=bank_conn_id,
            tx_timestamp=datetime.fromisoformat(p["date"]) if p["date"] else None,
        )
        saved += 1

    await db.commit()
    logger.info(f"✅ Sync saved {saved} new transactions for user {uid[:8]}...")

    return {"message": "Sync successful", "synced_count": saved}


@router.post("/disconnect")
async def disconnect_bank(
    db: AsyncSession = Depends(get_db),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    은행 연결 해제
    현재 사용자의 모든 active bank_connection을 revoked 상태로 변경합니다.
    """
    uid = user_id or "default"
    count = await revoke_bank_connections_for_user(db, uid)
    await db.commit()
    logger.info(f"Revoked {count} bank connection(s) for user {uid[:8]}...")
    return {"success": True, "revoked_count": count, "message": "Bank disconnected"}


@router.get("/health")
async def banking_health():
    """Banking 서비스 헬스체크"""
    return {
        "status": "healthy",
        "service": "Tink Open Banking",
        "client_id_configured": bool(tink_service.client_id),
        "message": "Ready to connect banks"
    }
