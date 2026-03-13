"""
🧪 Aura Finance AI Classifier - 데모 테스트 스크립트

상용화 전 로컬 테스트용 스크립트
실제 OpenAI API를 사용하여 다양한 가맹점 이름을 분류합니다.
"""

import asyncio
import os
from dotenv import load_dotenv
from services.ai_classifier import classify_transaction
from schemas.transaction import CityDistrict

# 환경 변수 로드
load_dotenv()

# 테스트 케이스 (전 세계 다양한 가맹점)
TEST_CASES = [
    # 음식/카페
    {"description": "STARBUCKS SEOUL", "amount": 5.50, "expected": CityDistrict.FOOD_CAFE},
    {"description": "MCDONALDS", "amount": 8.00, "expected": CityDistrict.FOOD_CAFE},
    {"description": "DOMINOS PIZZA", "amount": 22.50, "expected": CityDistrict.FOOD_CAFE},
    {"description": "WHOLE FOODS MARKET", "amount": 45.30, "expected": CityDistrict.FOOD_CAFE},

    # 쇼핑
    {"description": "AMAZON.COM", "amount": 89.99, "expected": CityDistrict.SHOPPING},
    {"description": "ZARA ONLINE", "amount": 65.00, "expected": CityDistrict.SHOPPING},
    {"description": "TARGET", "amount": 34.20, "expected": CityDistrict.SHOPPING},
    {"description": "UNIQLO", "amount": 29.90, "expected": CityDistrict.SHOPPING},

    # 주거/공과금
    {"description": "COMCAST CABLE", "amount": 79.99, "expected": CityDistrict.HOUSING},
    {"description": "ELECTRIC COMPANY", "amount": 120.00, "expected": CityDistrict.HOUSING},
    {"description": "APARTMENT RENT", "amount": 1500.00, "expected": CityDistrict.HOUSING},

    # 엔터테인먼트
    {"description": "NETFLIX.COM", "amount": 15.99, "expected": CityDistrict.ENTERTAINMENT},
    {"description": "SPOTIFY", "amount": 9.99, "expected": CityDistrict.ENTERTAINMENT},
    {"description": "STEAM GAMES", "amount": 59.99, "expected": CityDistrict.ENTERTAINMENT},
    {"description": "CGV CINEMA", "amount": 12.00, "expected": CityDistrict.ENTERTAINMENT},

    # 교통
    {"description": "TFL.GOV.UK LONDON", "amount": 3.20, "expected": CityDistrict.TRANSPORT},
    {"description": "UBER TRIP", "amount": 18.50, "expected": CityDistrict.TRANSPORT},
    {"description": "SHELL GASOLINE", "amount": 45.00, "expected": CityDistrict.TRANSPORT},
    {"description": "SEOUL METRO", "amount": 1.50, "expected": CityDistrict.TRANSPORT},

    # 금융/클라우드
    {"description": "AWS*USAGE", "amount": 45.00, "expected": CityDistrict.FINANCE},
    {"description": "MICROSOFT AZURE", "amount": 120.00, "expected": CityDistrict.FINANCE},
    {"description": "BANK TRANSFER FEE", "amount": 2.50, "expected": CityDistrict.FINANCE},

    # 의료
    {"description": "CVS PHARMACY", "amount": 32.00, "expected": CityDistrict.HEALTHCARE},
    {"description": "SEOUL HOSPITAL", "amount": 150.00, "expected": CityDistrict.HEALTHCARE},

    # 교육
    {"description": "UDEMY COURSE", "amount": 19.99, "expected": CityDistrict.EDUCATION},
    {"description": "KYOBO BOOKSTORE", "amount": 28.00, "expected": CityDistrict.EDUCATION},
]


async def run_single_test(test_case: dict, test_num: int):
    """단일 테스트 실행"""
    print(f"\n{'='*80}")
    print(f"테스트 #{test_num}: {test_case['description']}")
    print(f"금액: ${test_case['amount']}")
    print(f"예상 카테고리: {test_case['expected'].value}")
    print('-' * 80)

    # AI 분류 실행
    result = await classify_transaction(
        description=test_case['description'],
        amount=test_case['amount']
    )

    # 결과 출력
    print(f"✅ AI 분류 결과:")
    print(f"  📍 구역: {result.district.value}")
    print(f"  🎯 신뢰도: {result.confidence:.2%}")
    print(f"  💡 이유: {result.reason}")
    print(f"  🎨 색상: {result.color}")
    print(f"  🎭 아이콘: {result.icon}")

    # 정확도 체크
    is_correct = result.district == test_case['expected']
    if is_correct:
        print(f"  ✅ 분류 정확!")
    else:
        print(f"  ⚠️  예상과 다름 (예상: {test_case['expected'].value})")

    return {
        "test_case": test_case['description'],
        "expected": test_case['expected'].value,
        "actual": result.district.value,
        "confidence": result.confidence,
        "correct": is_correct
    }


async def main():
    """메인 테스트 실행"""
    print("\n" + "="*80)
    print("🚀 Aura Finance AI Classifier - 상용화 테스트")
    print("="*80)

    if not os.getenv("OPENAI_API_KEY"):
        print("\n❌ 에러: OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
        print("💡 .env 파일을 생성하고 API 키를 입력하세요.")
        return

    print(f"\n총 {len(TEST_CASES)}개 테스트 케이스를 실행합니다...\n")

    results = []
    for i, test_case in enumerate(TEST_CASES, 1):
        result = await run_single_test(test_case, i)
        results.append(result)

        # API Rate Limit 방지
        if i < len(TEST_CASES):
            await asyncio.sleep(0.5)

    # 최종 통계
    print(f"\n{'='*80}")
    print("📊 테스트 결과 요약")
    print('='*80)

    correct_count = sum(1 for r in results if r['correct'])
    total_count = len(results)
    accuracy = correct_count / total_count * 100

    print(f"\n전체 정확도: {correct_count}/{total_count} ({accuracy:.1f}%)")
    print(f"평균 신뢰도: {sum(r['confidence'] for r in results) / total_count:.2%}")

    # 잘못 분류된 케이스 출력
    incorrect = [r for r in results if not r['correct']]
    if incorrect:
        print(f"\n⚠️  잘못 분류된 케이스 ({len(incorrect)}개):")
        for r in incorrect:
            print(f"  - {r['test_case']}")
            print(f"    예상: {r['expected']} → 실제: {r['actual']}")

    print(f"\n{'='*80}")
    print("✅ 테스트 완료!")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
