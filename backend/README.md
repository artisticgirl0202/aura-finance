# 🔥 Aura Finance Backend - AI Classifier Engine

**GPT-4o Structured Outputs 기반 금융 데이터 분류 API**

---

## 📋 주요 엔드포인트

### 1. 헬스체크
```
GET /
```

### 2. 단일 거래 분류
```
POST /api/v1/classify
```

**Request:**
```json
{
  "description": "STARBUCKS SEOUL",
  "amount": 5.5,
  "currency": "USD"
}
```

**Response:**
```json
{
  "district": "Food & Cafe",
  "confidence": 0.95,
  "reason": "Starbucks는 글로벌 커피 체인으로 식음료 카테고리",
  "icon": "coffee",
  "color": "#f59e0b"
}
```

### 3. 배치 거래 분류
```
POST /api/v1/classify/batch
```

**Request:**
```json
[
  {"description": "STARBUCKS", "amount": 5.5},
  {"description": "NETFLIX.COM", "amount": 15.99}
]
```

### 4. 구역 목록 조회
```
GET /api/v1/districts
```

---

## 🚀 실행 방법

```bash
# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp env.example .env
# .env 파일에 OPENAI_API_KEY 입력

# 서버 실행
python main.py
```

서버가 `http://localhost:8000` 에서 실행됩니다.

API 문서: http://localhost:8000/docs

---

## 🏗️ 아키텍처

```
main.py                 → FastAPI 진입점
├── schemas/
│   └── transaction.py  → Pydantic 데이터 모델
└── services/
    └── ai_classifier.py → GPT-4o 분류 로직
```

---

## 🔑 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 | ✅ |
| `API_HOST` | 서버 호스트 | ❌ (기본: 0.0.0.0) |
| `API_PORT` | 서버 포트 | ❌ (기본: 8000) |

---

## 🧪 테스트

```bash
# 단일 거래 테스트
curl -X POST http://localhost:8000/api/v1/classify \
  -H "Content-Type: application/json" \
  -d '{"description": "STARBUCKS", "amount": 5.5}'
```

---

## 🚀 상용화 최적화

- **비동기 처리**: `async/await`로 동시 요청 처리
- **Structured Outputs**: Pydantic 모델로 응답 강제, 파싱 에러 0%
- **에러 핸들링**: Fallback 로직으로 서비스 안정성 보장
- **배치 API**: 여러 거래를 한 번에 처리하여 비용 절감

---

## 📊 성능

- **평균 응답 시간**: ~500ms (GPT-4o-mini)
- **비용**: $0.00015/request (단일 분류 기준)
- **동시 처리**: FastAPI 비동기로 수백 개 요청 동시 처리

---

## 🔐 보안

상용화 배포 시 고려사항:
- CORS 오리진 제한
- API 키 인증
- Rate Limiting
- HTTPS 적용
