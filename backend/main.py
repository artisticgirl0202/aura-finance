from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect  # noqa: F811
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from schemas.transaction import ClassificationResult, TransactionInput
from services.ai_classifier import classify_transaction, batch_classify
from services.transaction_simulator import generate_random_transaction
from typing import List
import os
import uvicorn
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

# ── Logging configuration ──────────────────────────────────────────────────
# Custom log_config passed to uvicorn so our application logs (services.*)
# are always visible at INFO level, while noisy uvicorn.access HTTP lines
# are suppressed (set to WARNING → only errors appear, not every 200 OK).
_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "aura": {
            "format": "%(asctime)s [%(name)-28s] %(levelname)s  %(message)s",
            "datefmt": "%H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "aura",
            "stream": "ext://sys.stdout",
        }
    },
    "loggers": {
        # Uvicorn internals — keep errors, suppress per-request 200 OK spam
        "uvicorn":           {"handlers": ["console"], "level": "INFO",    "propagate": False},
        "uvicorn.error":     {"handlers": ["console"], "level": "INFO",    "propagate": False},
        "uvicorn.access":    {"handlers": ["console"], "level": "WARNING", "propagate": False},
        # File watcher — suppress "N changes detected" noise
        "watchfiles":        {"handlers": ["console"], "level": "WARNING", "propagate": False},
        # Application loggers — show all INFO messages
        "services":          {"handlers": ["console"], "level": "DEBUG",   "propagate": False},
        "routes":            {"handlers": ["console"], "level": "INFO",    "propagate": False},
        "schemas":           {"handlers": ["console"], "level": "INFO",    "propagate": False},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}

# Routes import
from routes.banking import router as banking_router
from routes.transactions import router as transactions_router
from routes.auth import router as auth_router
from routes.goals import router as goals_router
from routes.analytics import router as analytics_router
from routes.finance import router as finance_router
from routes.user_settings import router as user_settings_router

from contextlib import asynccontextmanager
from services.auth_service import GUEST_TOKEN, get_optional_user_id

@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import init_db
    await init_db()
    logger.info("🚀 Aura Finance API started — DB ready")
    yield

# FastAPI 앱 초기화
app = FastAPI(
    title="Aura Finance AI Engine",
    description="상용화급 AI 데이터 분류 엔진 - GPT-4o Structured Outputs + Tink Open Banking",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS 설정 — FRONTEND_URL 또는 ALLOWED_ORIGINS 환경 변수 사용
# 로컬: ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
# 프로덕션: ALLOWED_ORIGINS=https://your-app.vercel.app 또는 FRONTEND_URL
_allowed = os.getenv("ALLOWED_ORIGINS", "").strip() or os.getenv("FRONTEND_URL", "").strip()
if _allowed:
    _origins = [o.strip() for o in _allowed.split(",") if o.strip()]
else:
    _origins = ["*"]  # 개발 시 허용 (프로덕션에서는 반드시 설정 권장)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler so unhandled exceptions return JSON with CORS headers,
    instead of crashing without a response (which causes CORS errors in the browser).
    """
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": str(exc),
            "detail": "See server logs for stack trace.",
        },
    )

# 🏦 Banking Routes 등록
app.include_router(banking_router)

# 💾 Transactions + Budget Routes 등록
app.include_router(transactions_router)

# 🔐 Auth Routes (JWT)
app.include_router(auth_router)

# 🎯 Goals Routes (financial goal tracking)
app.include_router(goals_router)

# 💰 Finance Routes (Phase 1: balance, transactions, goals progress)
app.include_router(finance_router)

# 📊 Analytics Routes (budget vs actual, M4/M5/M6 AI)
app.include_router(analytics_router)

# ⚙️ User Settings (theme, currency, language — 기본값 반환)
app.include_router(user_settings_router)




@app.get("/")
async def root():
    """헬스체크 엔드포인트"""
    return {
        "service": "Aura Finance AI Classifier",
        "status": "operational",
        "version": "1.0.0"
    }


@app.get("/api/user-settings")
async def get_user_settings_legacy():
    """
    /api/user-settings 직접 호출 시 404 방지 (기본값 반환).
    v1 경로와 동일한 응답.
    """
    return {"theme": "dark", "currency": "USD", "language": "en"}


_bearer = HTTPBearer(auto_error=False)


def _reject_guest(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)):
    """게스트 토큰 시 403 반환 (mutation 차단)."""
    if credentials and credentials.credentials == GUEST_TOKEN:
        raise HTTPException(status_code=403, detail="Read-only in Guest Mode. Sign up or log in to add transactions.")


@app.post("/api/v1/classify", response_model=ClassificationResult)
async def classify_single_transaction(
    transaction: TransactionInput,
    _: None = Depends(_reject_guest),
    user_id: str | None = Depends(get_optional_user_id),
):
    """
    단일 거래 분류 + DB 자동 저장

    분류 결과는 즉시 aura_finance.db에 저장됩니다 (source='manual').
    게스트: 403 Read-only.
    """
    if not transaction.description or transaction.description.strip() == "":
        raise HTTPException(status_code=400, detail="Description cannot be empty")

    try:
        # Task 2: 사용자 과거 수동 분류 기록 검색 — Override 시 AI 생략, Few-shot으로 학습
        from database import AsyncSessionLocal
        from database.crud import find_manual_classification_match, get_manual_classification_examples
        from schemas.transaction import CityDistrict

        result = None
        few_shot: list = []
        uid = user_id if user_id and user_id != "guest" else "default"
        async with AsyncSessionLocal() as db:
            manual_match = await find_manual_classification_match(
                db, description=transaction.description.strip(), user_id=uid
            )
            if manual_match is None:
                few_shot = await get_manual_classification_examples(db, user_id=uid, limit=5)

        if manual_match:
            try:
                result = ClassificationResult(
                    district=CityDistrict(manual_match["district"]),
                    confidence=manual_match["confidence"],
                    reason=manual_match["reason"],
                    icon=manual_match["icon"],
                    color=manual_match["color"],
                )
                logger.info(
                    f"📋 Manual override: '{transaction.description[:35]}' → {result.district.value}"
                )
            except (ValueError, KeyError):
                result = None

        if result is None:
            result = await classify_transaction(
                description=transaction.description,
                amount=transaction.amount,
                few_shot_examples=few_shot if few_shot else None,
            )

        # DB 저장 (실패해도 분류 결과는 반환)
        try:
            from database import AsyncSessionLocal
            from database.crud import create_transaction
            from datetime import datetime, timezone
            uid = user_id if user_id and user_id != "guest" else "default"
            async with AsyncSessionLocal() as db:
                await create_transaction(
                    db,
                    description=transaction.description,
                    amount=transaction.amount or 0.0,
                    currency=transaction.currency or "USD",
                    district=str(result.district),
                    confidence=result.confidence,
                    reason=result.reason,
                    icon=result.icon,
                    color=result.color,
                    source="manual",
                    tx_timestamp=datetime.now(timezone.utc),
                    user_id=uid,
                )
                await db.commit()
        except Exception as db_err:
            logger.warning(f"DB save skipped for /classify: {db_err}")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.post("/api/v1/classify/batch", response_model=List[ClassificationResult])
async def classify_batch_transactions(
    transactions: List[TransactionInput],
    _: None = Depends(_reject_guest),
):
    """
    배치 거래 분류 (1 Gemini call) + DB 자동 저장

    최대 100개까지 처리 가능. 결과는 모두 DB에 저장됩니다 (source='manual').
    게스트: 403 Read-only.
    """
    if len(transactions) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 transactions per batch")

    descriptions = [t.description for t in transactions]
    amounts      = [t.amount      for t in transactions]
    results      = await batch_classify(descriptions, amounts)

    # DB 일괄 저장
    try:
        from database import AsyncSessionLocal
        from database.crud import create_transactions_bulk
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        records_data = [
            dict(
                description=t.description,
                amount=t.amount or 0.0,
                currency=t.currency or "USD",
                district=r.district,
                confidence=r.confidence,
                reason=r.reason,
                icon=r.icon,
                color=r.color,
                source="manual",
                tx_timestamp=now,
            )
            for t, r in zip(transactions, results)
        ]
        async with AsyncSessionLocal() as db:
            await create_transactions_bulk(db, records_data)
            await db.commit()
    except Exception as db_err:
        logger.warning(f"DB bulk save skipped for /classify/batch: {db_err}")

    return results


@app.get("/api/v1/districts")
async def get_districts():
    """
    사용 가능한 도시 구역 목록 반환
    프론트엔드에서 3D 맵 초기화 시 사용
    """
    from schemas.transaction import CityDistrict
    from services.ai_classifier import DISTRICT_COLOR_MAP, DISTRICT_ICON_MAP

    return {
        "districts": [
            {
                "id": district.value,
                "name": district.value,
                "icon": DISTRICT_ICON_MAP[district],
                "color": DISTRICT_COLOR_MAP[district]
            }
            for district in CityDistrict
        ]
    }


try:
    from websockets.exceptions import ConnectionClosed
except ImportError:
    ConnectionClosed = type("ConnectionClosed", (Exception,), {})


@app.websocket("/ws/simulation")
async def websocket_simulation(websocket: WebSocket):
    """
    실시간 거래 시뮬레이션 WebSocket

    3초마다 랜덤한 거래를 생성하고 AI로 분류하여 전송합니다.
    AI 실패 시 fallback으로 연결 유지. 모든 거래는 DB에 자동 저장됩니다 (source='simulation').
    """
    await websocket.accept()
    logger.info("[WebSocket] Simulation connected")

    from database import AsyncSessionLocal
    from database.crud import create_transaction
    from datetime import datetime, timezone

    try:
        while True:
            try:
                # 1. 랜덤 거래 생성 (type: expense/income/investment)
                transaction = generate_random_transaction()
                tx_type = transaction.get("type", "expense")

                # 2. 분류 — expense만 AI, income/investment는 static 딕셔너리 사용
                if tx_type == "expense":
                    try:
                        classification_obj = await classify_transaction(
                            description=transaction["description"],
                            amount=transaction["amount"]
                        )
                        cls_data = {
                            "district":   classification_obj.district,
                            "confidence": classification_obj.confidence,
                            "reason":     classification_obj.reason,
                            "icon":       classification_obj.icon,
                            "color":      classification_obj.color,
                        }
                    except Exception as ai_err:
                        logger.warning(f"[WS] AI classify failed, using fallback: {ai_err}")
                        cls_data = {
                            "district":   "Food & Cafe",
                            "confidence": 0.5,
                            "reason":     "AI unavailable - fallback classification",
                            "icon":       "🍽️",
                            "color":      "#f59e0b",
                        }
                else:
                    cls_data = transaction.get("static_classification", {
                        "district":   "Unknown",
                        "confidence": 0.8,
                        "reason":     f"Classified as {tx_type}",
                        "icon":       "circle",
                        "color":      "#64748b",
                    })

                # 3. 결과 패키징 (type 포함)
                result = {
                    "description":    transaction["description"],
                    "amount":         transaction["amount"],
                    "currency":       transaction["currency"],
                    "type":           tx_type,
                    "classification": cls_data,
                    "timestamp":      asyncio.get_event_loop().time()
                }

                # 4. DB 저장 (비동기 - WebSocket 흐름 차단 없음)
                try:
                    async with AsyncSessionLocal() as db:
                        await create_transaction(
                            db,
                            description=transaction["description"],
                            amount=transaction["amount"],
                            currency=transaction["currency"],
                            tx_type=tx_type,
                            district=cls_data["district"],
                            confidence=cls_data["confidence"],
                            reason=cls_data.get("reason"),
                            icon=cls_data.get("icon"),
                            color=cls_data.get("color"),
                            source="simulation",
                            tx_timestamp=datetime.now(timezone.utc),
                        )
                        await db.commit()
                except Exception as db_err:
                    logger.warning(f"[WS] DB save skipped: {db_err}")

                # 5. WebSocket으로 전송
                await websocket.send_json(result)
                logger.debug(
                    f"[WS] [{tx_type.upper()}] {transaction['description']} → {cls_data['district']}"
                )
            except (WebSocketDisconnect, ConnectionClosed):
                # 클라이언트 연결 종료 → 루프 탈출 후 안전하게 정리
                raise
            except Exception as loop_err:
                err_msg = str(loop_err) or repr(loop_err)
                logger.error(f"[WS] Transaction loop error: {type(loop_err).__name__}: {err_msg}")
                # 연결 관련 오류(closed/disconnect) → 루프 탈출
                if any(k in err_msg.lower() for k in ("closed", "disconnect", "connection")):
                    break

            # 6. 3초 대기
            await asyncio.sleep(3)

    except WebSocketDisconnect:
        logger.info("[WebSocket] Simulation disconnected")
    except ConnectionClosed:
        logger.info("[WebSocket] Simulation connection closed")
    except Exception as e:
        logger.error(f"[WebSocket Fatal Error] {type(e).__name__}: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    _port = int(os.getenv("PORT", "8000"))
    _reload = os.getenv("ENV", "production") == "development"  # 프로덕션 기본값: reload 비활성화
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=_port,
        reload=_reload,
        log_config=_LOG_CONFIG,
    )
