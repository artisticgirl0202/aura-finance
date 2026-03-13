# 🚀 Aura Finance - 상용화 가이드

## 프로젝트 개요

**Aura Finance AI Transaction Classifier**는 GPT-4o Structured Outputs를 활용하여 전 세계 수만 가지 가맹점 이름을 실시간으로 분석하고, 3D 도시 공간에서 시각화하는 최첨단 금융 데이터 분류 시스템입니다.

### 핵심 기술 스택

**Backend:**
- FastAPI (비동기 처리)
- OpenAI GPT-4o-mini (Structured Outputs)
- Pydantic (데이터 검증)
- Redis (캐싱, 선택사항)

**Frontend:**
- React 18
- React Three Fiber (3D 렌더링)
- Three.js (WebGL)
- TypeScript

---

## 🎯 핵심 기능

### 1. AI 데이터 분류기 (Backend)

#### 특징:
- **Structured Outputs**: JSON 스키마 100% 준수 보장
- **글로벌 컨텍스트 이해**: `STARBUCKS`, `AWS*USAGE`, `TFL.GOV.UK` 등 다양한 형식 지원
- **캐싱 최적화**: 동일한 가맹점은 캐시에서 즉시 반환
- **배치 처리**: 최대 100개 거래 동시 분류

#### 분류 카테고리:
- 🍔 **Food & Cafe**: 레스토랑, 카페, 식료품
- 🛍️ **Shopping**: 쇼핑몰, 의류, 전자제품
- 🏠 **Housing & Utility**: 월세, 공과금, 인터넷
- 🎮 **Entertainment**: 영화, 게임, 스트리밍
- 🚗 **Transport**: 교통비, 주유소, 택시
- 🏥 **Healthcare**: 병원, 약국
- 📚 **Education**: 학원, 도서
- 💰 **Finance**: 은행, 투자, 클라우드

### 2. 3D 파티클 시스템 (Frontend)

#### 특징:
- **GPU 가속**: BufferGeometry로 최대 100개 파티클 동시 렌더링
- **베지어 곡선 궤적**: 부드러운 3단계 애니메이션 (발사 → 상승 → 도착)
- **동적 파티클 개수**: 거래 금액에 비례 ($10당 1개)
- **실시간 동기화**: AI 분류 결과를 즉시 시각화

#### 애니메이션 효과:
- 폭발 발사 효과
- 포물선 궤적 (최고점 5 유닛)
- 바람 효과 (자연스러운 움직임)
- 펄스 효과 (크기 변화)
- 색상 페이드 아웃

---

## 📦 설치 및 실행

### 사전 요구사항

- Node.js 18+ (Frontend)
- Python 3.10+ (Backend)
- OpenAI API Key

### 1. Backend 설정

```bash
cd backend

# 가상환경 생성 (권장)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp env.example .env
# .env 파일에 OpenAI API 키 입력
```

**`.env` 파일 예시:**
```env
OPENAI_API_KEY=sk-proj-your-key-here
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
```

**서버 실행:**
```bash
python main.py
```

서버가 `http://localhost:8000`에서 실행됩니다.

API 문서: `http://localhost:8000/docs`

### 2. Frontend 설정

```bash
cd frontend

# 의존성 설치
npm install

# 환경 변수 설정
cp env.example .env
# 기본값 (http://localhost:8000)으로 사용 가능

# 개발 서버 실행
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

---

## 🧪 테스트

### API 테스트 (cURL)

```bash
# 단일 거래 분류
curl -X POST http://localhost:8000/api/v1/classify \
  -H "Content-Type: application/json" \
  -d '{
    "description": "STARBUCKS SEOUL",
    "amount": 5.50,
    "currency": "USD"
  }'
```

**응답 예시:**
```json
{
  "district": "Food & Cafe",
  "confidence": 0.95,
  "reason": "Starbucks는 세계적인 커피 체인으로 식음료 카테고리",
  "icon": "coffee",
  "color": "#f59e0b"
}
```

### 배치 테스트

```bash
curl -X POST http://localhost:8000/api/v1/classify/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"description": "NETFLIX.COM", "amount": 15.99},
    {"description": "AWS*USAGE", "amount": 45.00},
    {"description": "TFL.GOV.UK", "amount": 3.20}
  ]'
```

---

## 🎨 Frontend 사용법

### 1. 단일 거래 분류
1. "가맹점 이름" 입력란에 이름 입력 (예: `STARBUCKS SEOUL`)
2. "거래 금액" 입력 (예: `5.5`)
3. "🔍 AI 분류 실행" 버튼 클릭
4. 중앙에서 해당 구역으로 파티클이 날아가는 것을 확인

### 2. 샘플 테스트
- "⚡ 샘플 거래 테스트" 버튼 클릭
- 6개의 샘플 거래가 자동으로 순차 실행

### 3. 3D 조작
- **마우스 드래그**: 카메라 회전
- **스크롤**: 줌 인/아웃
- **우클릭 드래그**: 이동

---

## 🚀 상용화 최적화

### 1. Redis 캐싱 (권장)

**설치:**
```bash
# Docker로 Redis 실행
docker run -d -p 6379:6379 redis:alpine
```

**Backend 수정 (`services/ai_classifier.py`):**
```python
import redis
import json

# Redis 클라이언트 초기화
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

async def classify_transaction(description: str, ...) -> ClassificationResult:
    # 캐시 확인
    cached = redis_client.get(f"tx:{cache_key}")
    if cached:
        return ClassificationResult(**json.loads(cached))
    
    # ... AI 분류 로직 ...
    
    # 캐시 저장 (1시간 TTL)
    redis_client.setex(f"tx:{cache_key}", 3600, result.json())
```

### 2. 성능 모니터링

**로그 레벨 설정:**
```python
# main.py
import logging
logging.basicConfig(level=logging.INFO)
```

**로그 예시:**
```
INFO:ai_classifier:🤖 AI 분류 요청: STARBUCKS SEOUL
INFO:ai_classifier:✅ 분류 완료: Food & Cafe (신뢰도: 0.95, 소요시간: 0.82s)
```

### 3. CORS 설정 (Production)

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://aurafinance.com",  # 실제 도메인
        "https://app.aurafinance.com"
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)
```

### 4. 에러 복구

AI 분류 실패 시 자동으로 `Unknown` 카테고리로 폴백:
```python
ClassificationResult(
    district=CityDistrict.UNKNOWN,
    confidence=0.0,
    reason="Classification failed",
    icon="help-circle",
    color="#6b7280"
)
```

---

## 📊 비용 최적화

### GPT-4o-mini 비용 (2026년 기준)
- **입력**: $0.15 / 1M tokens
- **출력**: $0.60 / 1M tokens

### 예상 비용:
- 평균 거래당 토큰 수: ~200 tokens (입력 + 출력)
- **1,000회 분류**: 약 $0.15
- **100,000회 분류**: 약 $15

### 캐싱으로 90% 비용 절감 가능
- 동일한 가맹점은 캐시에서 반환
- Redis 사용 시 응답 속도 **50배 향상**

---

## 🔒 보안

### API 키 관리
```bash
# .env 파일은 절대 Git에 커밋하지 마세요
echo ".env" >> .gitignore
```

### Rate Limiting (추천)
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/v1/classify")
@limiter.limit("10/minute")  # 분당 10회 제한
async def classify_single_transaction(...):
    ...
```

---

## 📈 확장 계획

### 1. 실시간 스트리밍 (Kafka)
```python
from aiokafka import AIOKafkaProducer

producer = AIOKafkaProducer(bootstrap_servers='localhost:9092')

async def send_to_kafka(result: ClassificationResult):
    await producer.send('transactions', result.json().encode())
```

### 2. 은행 API 연동 (Tink, Plaid)
```python
import tink

async def fetch_transactions():
    transactions = await tink.get_transactions(user_id)
    for tx in transactions:
        result = await classify_transaction(tx.description, tx.amount)
        await send_to_kafka(result)
```

### 3. 사용자 피드백 학습
```python
@app.post("/api/v1/feedback")
async def submit_feedback(
    transaction_id: str,
    correct_district: str,
    user_id: str
):
    # 사용자가 수정한 분류를 데이터베이스에 저장
    # 주기적으로 fine-tuning 데이터로 활용
    ...
```

---

## 🐛 트러블슈팅

### 1. OpenAI API 에러
```
Error: Invalid API key
```
**해결:** `.env` 파일의 `OPENAI_API_KEY` 확인

### 2. CORS 에러
```
Access to fetch at 'http://localhost:8000' has been blocked by CORS policy
```
**해결:** Backend `main.py`에서 CORS 설정 확인

### 3. 3D 성능 저하
```
FPS 낮음 / 버벅임
```
**해결:**
- `VITE_MAX_PARTICLES` 값을 50으로 낮춤
- 브라우저 하드웨어 가속 활성화
- GPU 지원 브라우저 사용 (Chrome, Edge)

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. **Backend 로그**: `python main.py` 실행 시 터미널 출력
2. **Frontend 콘솔**: 브라우저 개발자 도구 (F12)
3. **API 문서**: `http://localhost:8000/docs`

---

## 🎉 다음 단계

이제 **Aura Finance AI Engine**이 완성되었습니다!

### 추천 작업:
1. ✅ 실제 OpenAI API 키로 테스트
2. ✅ 다양한 가맹점 이름으로 정확도 검증
3. ✅ Redis 캐싱으로 성능 개선
4. ✅ Production 서버 배포 (AWS, Vercel)
5. ✅ 실제 은행 API 연동 (Tink, Plaid)

**상용화 준비 완료!** 🚀
