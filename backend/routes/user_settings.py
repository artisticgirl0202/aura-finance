"""
Aura Finance — User Settings API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GET /api/v1/user-settings — 사용자 설정 조회 (기본값 반환)
  - DB에 설정 테이블이 없어도 404 없이 기본값 반환
  - theme, currency, language 등
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["user-settings"])


@router.get("/user-settings")
async def get_user_settings():
    """
    사용자 설정 조회.
    DB에 설정 테이블이 없으면 기본값을 반환 (404 방지).
    """
    return {
        "theme": "dark",
        "currency": "USD",
        "language": "en",
    }
