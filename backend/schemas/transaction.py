from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class CityDistrict(str, Enum):
    """
    도시의 구역 정의 - 각 소비/수입 카테고리에 대응하는 3D 공간의 영역
    상용화를 위해 확장 가능하도록 설계됨
    """
    FOOD_CAFE = "Food & Cafe"        # 식비, 카페
    SHOPPING = "Shopping"            # 쇼핑, 잡화
    HOUSING = "Housing & Utility"    # 월세, 공과금
    ENTERTAINMENT = "Entertainment"   # 취미, 스트리밍
    TRANSPORT = "Transport"          # 교통, 주유
    HEALTHCARE = "Healthcare"        # 병원, 약국
    EDUCATION = "Education"          # 교육, 도서
    FINANCE = "Finance"              # 금융, 투자
    FREELANCE = "Freelance"          # 프리랜스 수입
    RENTAL_INCOME = "Rental Income"   # 임대 수입
    SALARY = "Salary"                # 급여
    SIDE_INCOME = "Side Income"      # 부수입
    UNKNOWN = "Unknown"


class ClassificationResult(BaseModel):
    """
    AI 분류 결과를 구조화된 형태로 반환
    GPT-4o Structured Outputs를 통해 100% 스키마 준수 보장
    """
    district: CityDistrict = Field(
        description="도시의 어느 구역에 매핑될지 결정합니다."
    )
    confidence: float = Field(
        description="분류 결과에 대한 확신도 (0.0~1.0)",
        ge=0.0,
        le=1.0
    )
    reason: str = Field(
        description="이 구역으로 분류한 AI의 논리적 근거"
    )
    icon: str = Field(
        description="3D 공간에서 보여줄 Lucide 아이콘 이름"
    )
    color: str = Field(
        description="파티클의 색상 (hex 코드)",
        default="#3b82f6"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "district": "Food & Cafe",
                "confidence": 0.95,
                "reason": "Starbucks는 세계적인 커피 체인으로 음식/카페 카테고리에 해당",
                "icon": "coffee",
                "color": "#f59e0b"
            }
        }


class TransactionInput(BaseModel):
    """
    거래 분류 요청 입력 모델
    """
    description: str = Field(
        description="가맹점 이름 또는 거래 설명",
        min_length=1,
        max_length=500
    )
    amount: Optional[float] = Field(
        description="거래 금액 (옵션, 컨텍스트 제공용)",
        default=None
    )
    currency: Optional[str] = Field(
        description="통화 코드 (예: USD, EUR, KRW)",
        default="USD"
    )
