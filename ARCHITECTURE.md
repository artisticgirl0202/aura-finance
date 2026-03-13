# 🏛️ Aura Finance - 시스템 아키텍처

## 개요

Aura Finance는 **GPT-4o Structured Outputs**를 활용한 AI 기반 금융 데이터 분류 및 3D 시각화 플랫폼입니다.

---

## 📊 시스템 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 브라우저                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              React + Three.js Frontend                   │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │   │
│  │  │ CityScene  │  │  Particle  │  │ Transaction    │    │   │
│  │  │ (3D View)  │  │  System    │  │ Classifier Hook│    │   │
│  │  └────────────┘  └────────────┘  └────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/REST API
                      │ WebSocket (옵션)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Layer                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │   │
│  │  │ /classify  │  │ /batch     │  │ /districts     │    │   │
│  │  └────────────┘  └────────────┘  └────────────────┘    │   │
│  └─────────────┬────────────────────────────────────────────┘   │
│                │                                                 │
│  ┌─────────────▼────────────────────────────────────────────┐   │
│  │              AI Classification Service                    │   │
│  │  ┌────────────────────────────────────────────────┐      │   │
│  │  │  classify_transaction()                        │      │   │
│  │  │  - 캐싱 확인 (Redis/Memory)                    │      │   │
│  │  │  - GPT-4o API 호출                             │      │   │
│  │  │  - Structured Output 파싱                      │      │   │
│  │  │  - 결과 캐싱 저장                               │      │   │
│  │  └────────────────────────────────────────────────┘      │   │
│  └─────────────┬────────────────────────────────────────────┘   │
└────────────────┼─────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │  OpenAI API  │  │    Redis     │  │   PostgreSQL     │      │
│  │  (GPT-4o)    │  │   (Cache)    │  │  (Storage)       │      │
│  └──────────────┘  └──────────────┘  └──────────────────┘      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │  Tink API    │  │    Kafka     │  │   Prometheus     │      │
│  │  (Banking)   │  │  (Stream)    │  │  (Monitoring)    │      │
│  └──────────────┘  └──────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 데이터 흐름

### 1. 단일 거래 분류 플로우

```
사용자 입력
    │
    │ "STARBUCKS SEOUL", $5.5
    ▼
[Frontend] useTransactionClassifier Hook
    │
    │ POST /api/v1/classify
    │ { description, amount, currency }
    ▼
[Backend] FastAPI Router (/api/v1/classify)
    │
    │ Validation (Pydantic)
    ▼
[Service] classify_transaction()
    │
    ├──► [Cache] Redis 확인
    │      │
    │      ├─ HIT ──► 캐시 데이터 반환 (~1ms)
    │      │
    │      └─ MISS ─┐
    │                │
    │                ▼
    │         [OpenAI] GPT-4o-mini API
    │                │ Structured Outputs
    │                │ { district, confidence, reason, icon, color }
    │                ▼
    │         [Cache] 결과 저장 (TTL: 1시간)
    │                │
    └────────────────┘
    │
    ▼
ClassificationResult {
  district: "Food & Cafe",
  confidence: 0.95,
  reason: "...",
  icon: "coffee",
  color: "#f59e0b"
}
    │
    ▼
[Frontend] 3D 파티클 생성
    │
    ├─ 시작 위치: (0, 1, 0)
    ├─ 목표 위치: districtPositions["Food & Cafe"]
    ├─ 파티클 개수: amount / 10
    └─ 애니메이션: 4-5초간 베지어 곡선 궤적
```

---

## 🧩 핵심 컴포넌트 상세

### Backend 컴포넌트

#### 1. FastAPI Application (`main.py`)

```python
FastAPI App
├── CORS Middleware (보안)
├── Routes
│   ├── POST /api/v1/classify        # 단일 거래 분류
│   ├── POST /api/v1/classify/batch  # 배치 분류 (최대 100개)
│   └── GET  /api/v1/districts       # 구역 메타데이터
├── Exception Handlers
└── Health Check (/)
```

**특징:**
- 비동기 처리 (async/await)
- 자동 API 문서 생성 (Swagger UI)
- 타입 안전성 (Pydantic)

#### 2. AI Classifier Service (`services/ai_classifier.py`)

```python
classify_transaction(description, amount, use_cache)
│
├── 1. 캐시 키 생성 (MD5 해시)
│
├── 2. 캐시 확인
│   ├── HIT → 즉시 반환
│   └── MISS → 3단계로
│
├── 3. GPT-4o API 호출
│   ├── System Prompt (분류 규칙)
│   ├── User Message (거래 정보)
│   └── Response Format (Pydantic 모델)
│
├── 4. Structured Output 파싱
│   └── 100% 스키마 준수 보장
│
├── 5. 아이콘/색상 할당
│   └── DISTRICT_ICON_MAP, DISTRICT_COLOR_MAP
│
└── 6. 캐시 저장 (TTL: 1시간)
```

**주요 함수:**
- `classify_transaction()` - 단일 분류
- `batch_classify()` - 배치 분류 (병렬 처리)

#### 3. Data Models (`schemas/transaction.py`)

```python
CityDistrict (Enum)
├── FOOD_CAFE
├── SHOPPING
├── HOUSING
├── ENTERTAINMENT
├── TRANSPORT
├── HEALTHCARE
├── EDUCATION
└── FINANCE

ClassificationResult (Pydantic BaseModel)
├── district: CityDistrict
├── confidence: float (0.0-1.0)
├── reason: str
├── icon: str (Lucide Icons)
└── color: str (Hex Code)

TransactionInput (Pydantic BaseModel)
├── description: str
├── amount: float (optional)
└── currency: str (optional)
```

---

### Frontend 컴포넌트

#### 1. App Component (`App.tsx`)

```typescript
App
├── State Management
│   ├── districts (구역 메타데이터)
│   └── transactions (활성 거래 목록)
│
├── Hooks
│   └── useTransactionClassifier
│       ├── classifyTransaction()
│       ├── classifyBatch()
│       └── clearTransactions()
│
└── UI Components
    ├── CityScene (3D 뷰)
    ├── Control Panel (입력 폼)
    └── Legend (구역 색상 범례)
```

#### 2. 3D Scene (`CityScene.tsx`)

```typescript
CityScene
├── Canvas (React Three Fiber)
│   ├── Camera (position, fov)
│   ├── Lighting
│   │   ├── AmbientLight
│   │   ├── DirectionalLight (그림자)
│   │   └── PointLights (구역별)
│   │
│   ├── Environment
│   │   ├── Stars (배경)
│   │   └── Night Preset
│   │
│   ├── City Districts (구역 건물들)
│   │   └── CityDistrict × N
│   │       ├── 3D Box Mesh
│   │       ├── Text Label
│   │       └── Point Light
│   │
│   ├── Particle Systems
│   │   └── ParticleSystem × N (활성 거래)
│   │       ├── BufferGeometry
│   │       ├── PointsMaterial
│   │       └── Animation Loop
│   │
│   ├── Platform (중앙 발사대)
│   │   └── Cylinder Mesh
│   │
│   └── Grid Helper (바닥)
│
└── Controls
    └── OrbitControls (카메라 조작)
```

#### 3. Particle System (`ParticleSystem.tsx`)

```typescript
ParticleSystem
│
├── 초기화
│   ├── 파티클 개수 계산 (amount / 10)
│   ├── BufferGeometry 생성
│   │   ├── positions (x, y, z)
│   │   ├── colors (r, g, b)
│   │   └── sizes
│   └── PointsMaterial 설정
│       ├── vertexColors: true
│       ├── transparent: true
│       ├── blending: AdditiveBlending
│       └── sizeAttenuation: true
│
└── 애니메이션 루프 (useFrame)
    │
    ├── 1단계: 폭발 발사 (0-30%)
    │   └── 구형 분산 패턴
    │
    ├── 2단계: 상승 (30-50%)
    │   └── 베지어 곡선 (중간점)
    │
    ├── 3단계: 도착 (50-100%)
    │   └── 베지어 곡선 (목표 지점)
    │
    ├── 효과
    │   ├── 바람 효과 (sin/cos)
    │   ├── 펄스 효과 (크기 변화)
    │   └── 페이드 아웃 (색상)
    │
    └── 버퍼 업데이트
        └── needsUpdate = true
```

**성능 최적화:**
- GPU 가속 BufferGeometry
- 최대 80개 파티클 제한
- 5초 후 자동 제거

---

## 🔐 보안 아키텍처

### 1. API Key 관리

```
개발 환경:
  .env 파일 (Git에서 제외)
  
프로덕션 환경:
  AWS Secrets Manager
  └── aura-finance/openai-key
      └── SecretString
```

### 2. CORS 정책

```python
# 개발
allow_origins = ["http://localhost:5173", "http://localhost:3000"]

# 프로덕션
allow_origins = [
    "https://aurafinance.com",
    "https://app.aurafinance.com"
]
```

### 3. Rate Limiting

```python
@limiter.limit("100/minute")  # 사용자당 분당 100회
async def classify_single_transaction(...):
    ...
```

---

## 📈 성능 최적화 전략

### 1. 캐싱 계층

```
┌─────────────────────────────────────────┐
│ L1: 메모리 캐시 (Python dict)            │
│ TTL: 1시간                               │
│ 용도: 개발/테스트                        │
└─────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ L2: Redis 캐시                           │
│ TTL: 24시간                              │
│ 용도: 프로덕션                           │
│ 성능: 800배 빠름 (1ms vs 800ms)         │
└─────────────────────────────────────────┘
```

### 2. 배치 처리

```python
# 단일 호출: 100개 거래 = 100번 API 호출 (80초)
for tx in transactions:
    classify_transaction(tx)

# 배치 호출: 100개 거래 = 1번 API 호출 (0.8초)
batch_classify(transactions)  # 100배 빠름!
```

### 3. 3D 렌더링 최적화

```typescript
// BufferGeometry (GPU 최적화)
- positions: Float32Array
- colors: Float32Array
- sizes: Float32Array

// 인스턴싱 (향후 개선)
InstancedMesh로 건물 렌더링 (성능 10배 향상)
```

---

## 🔄 확장 가능성

### 수평 확장 (Horizontal Scaling)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Backend #1  │  │ Backend #2  │  │ Backend #3  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                   ┌────▼────┐
                   │  Redis  │ (공유 캐시)
                   └─────────┘
```

### 수직 확장 (Vertical Scaling)

```
- 더 강력한 GPU (3D 렌더링)
- 더 많은 메모리 (캐싱)
- 더 빠른 CPU (AI 처리)
```

---

## 📊 모니터링 지표

### 1. Backend Metrics

```prometheus
# 분류 횟수
aura_classifications_total{district="Food & Cafe"} 1234

# 응답 시간
aura_classification_duration_seconds_bucket{le="0.5"} 890
aura_classification_duration_seconds_bucket{le="1.0"} 980

# 캐시 히트율
aura_cache_hit_rate 0.85  # 85%
```

### 2. Frontend Metrics

```javascript
// 렌더링 FPS
monitor.fps = 60

// 활성 파티클 수
monitor.activeParticles = 150

// 메모리 사용량
monitor.memoryUsage = performance.memory.usedJSHeapSize
```

---

## 🚀 배포 아키텍처

### AWS 배포 예시

```
┌─────────────────────────────────────────────────────┐
│                  CloudFront CDN                      │
│               (Frontend Static Assets)               │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│            Application Load Balancer                │
└────┬───────────────────────────────────────────┬────┘
     │                                           │
┌────▼──────────┐                      ┌────────▼─────┐
│ ECS Service 1 │                      │ ECS Service 2│
│ (Backend)     │                      │ (Backend)    │
└───────┬───────┘                      └───────┬──────┘
        │                                      │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  ElastiCache (Redis)        │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  RDS (PostgreSQL)           │
        └─────────────────────────────┘
```

---

## 📚 기술 스택 요약

| 레이어 | 기술 | 목적 |
|--------|------|------|
| **Frontend** | React 18 | UI 프레임워크 |
| | React Three Fiber | 3D 렌더링 |
| | Three.js | WebGL 엔진 |
| | TypeScript | 타입 안전성 |
| | Vite | 빌드 도구 |
| **Backend** | FastAPI | API 프레임워크 |
| | Python 3.10+ | 언어 |
| | Pydantic | 데이터 검증 |
| | OpenAI API | AI 분류 |
| **Storage** | Redis | 캐싱 |
| | PostgreSQL | 영구 저장소 |
| **DevOps** | Docker | 컨테이너화 |
| | Kubernetes | 오케스트레이션 |
| | Prometheus | 모니터링 |
| | Grafana | 시각화 |

---

## 🎯 설계 원칙

1. **Separation of Concerns**: 백엔드/프론트엔드 명확히 분리
2. **Scalability First**: 수평/수직 확장 가능한 구조
3. **Performance**: 캐싱, 배치 처리, GPU 가속
4. **Type Safety**: Pydantic + TypeScript로 런타임 에러 최소화
5. **Developer Experience**: 자동 문서, 핫 리로드, 명확한 에러 메시지

---

**아키텍처 버전:** 1.0.0  
**최종 수정일:** 2026-02-02
