# 🌆 Aura Finance - AI 기반 금융 데이터 시각화 플랫폼

**상용화를 목표로 하는 차세대 금융 시각화 시스템**

GPT-4o의 **Structured Outputs**를 활용하여 전 세계 가맹점 거래 데이터를 실시간으로 분석하고, React Three Fiber로 구축한 3D 도시 공간에 시각화합니다.

![Aura Finance](https://img.shields.io/badge/Aura-Finance-blue?style=for-the-badge)
![GPT-4o](https://img.shields.io/badge/GPT--4o-Structured%20Outputs-green?style=for-the-badge)
![Three.js](https://img.shields.io/badge/Three.js-3D%20Visualization-orange?style=for-the-badge)

---

## 🎯 프로젝트 개요

### 핵심 기능

1. **AI 데이터 분류기**
   - OpenAI GPT-4o-mini의 Structured Outputs 활용
   - 단순한 if-else가 아닌 문맥 이해 기반 분류
   - 글로벌 브랜드부터 로컬 상점까지 자동 인식

2. **3D 실시간 시각화**
   - React Three Fiber 기반 WebGL 렌더링
   - 파티클 시스템으로 거래 흐름 표현
   - 구역별 색상/아이콘으로 직관적 UX

3. **상용화 최적화**
   - FastAPI 비동기 처리
   - 배치 API로 대량 거래 처리
   - Redis 캐싱 준비 (옵션)

---

## 🏗️ 프로젝트 구조

```
AuraFinance/
├── backend/                    # FastAPI 백엔드
│   ├── main.py                 # API 진입점
│   ├── services/
│   │   └── ai_classifier.py   # AI 분류 엔진 (GPT-4o)
│   ├── schemas/
│   │   └── transaction.py     # Pydantic 데이터 모델
│   ├── requirements.txt        # Python 의존성
│   └── env.example             # 환경 변수 예시
│
└── frontend/                   # React + Three.js 프론트엔드
    ├── src/
    │   ├── components/
    │   │   └── 3d/
    │   │       ├── CityScene.tsx      # 메인 3D 씬
    │   │       ├── CityDistrict.tsx   # 도시 구역 건물
    │   │       └── ParticleSystem.tsx # 파티클 애니메이션
    │   ├── hooks/
    │   │   └── useTransactionClassifier.ts  # API 통신 훅
    │   ├── App.tsx             # 메인 앱
    │   └── main.tsx            # 진입점
    ├── package.json
    ├── vite.config.ts
    └── env.example
```

---

## 🚀 빠른 시작 가이드

### 1️⃣ 사전 요구사항

- **Node.js** 18+ (프론트엔드)
- **Python** 3.10+ (백엔드)
- **OpenAI API Key** ([여기서 발급](https://platform.openai.com/api-keys))

---

### 2️⃣ 백엔드 설치 및 실행

```bash
# 1. 백엔드 디렉토리로 이동
cd backend

# 2. Python 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경 변수 설정
cp env.example .env
# .env 파일을 열고 OpenAI API 키 입력:
# OPENAI_API_KEY=sk-your-key-here

# 5. 서버 실행
python main.py
```

✅ **백엔드가 http://localhost:8000 에서 실행됩니다**

API 문서 확인: http://localhost:8000/docs

---

### 3️⃣ 프론트엔드 설치 및 실행

```bash
# 1. 프론트엔드 디렉토리로 이동
cd frontend

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp env.example .env
# 기본값이 이미 설정되어 있음 (http://localhost:8000)

# 4. 개발 서버 실행
npm run dev
```

✅ **프론트엔드가 http://localhost:3000 에서 실행됩니다**

브라우저가 자동으로 열리며 3D 도시가 표시됩니다.

---

## 💡 사용 방법

### 웹 인터페이스

1. **왼쪽 컨트롤 패널**에서 가맹점 이름 입력
   ```
   예시:
   - STARBUCKS SEOUL
   - AWS*USAGE
   - TFL.GOV.UK LONDON
   - NETFLIX.COM
   ```

2. 거래 금액 입력 (파티클 개수에 영향)

3. **"🔍 AI 분류 실행"** 버튼 클릭

4. 3D 도시에서 파티클이 중앙에서 해당 구역으로 날아가는 것을 확인

5. **"⚡ 샘플 거래 테스트"** 버튼으로 데모 실행 가능

---

### API 사용 예시

#### 단일 거래 분류

```bash
curl -X POST http://localhost:8000/api/v1/classify \
  -H "Content-Type: application/json" \
  -d '{
    "description": "STARBUCKS SEOUL",
    "amount": 5.5,
    "currency": "USD"
  }'
```

**응답:**
```json
{
  "district": "Food & Cafe",
  "confidence": 0.95,
  "reason": "Starbucks는 글로벌 커피 체인으로 식음료 카테고리",
  "icon": "coffee",
  "color": "#f59e0b"
}
```

#### 배치 거래 분류

```bash
curl -X POST http://localhost:8000/api/v1/classify/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"description": "STARBUCKS", "amount": 5.5},
    {"description": "NETFLIX.COM", "amount": 15.99},
    {"description": "SEOUL METRO", "amount": 1.5}
  ]'
```

---

## 🎨 지원하는 도시 구역

| 구역 | 설명 | 색상 | 아이콘 |
|------|------|------|--------|
| **Food & Cafe** | 식비, 카페 | 🟠 Amber | coffee |
| **Shopping** | 쇼핑, 잡화 | 🩷 Pink | shopping-bag |
| **Housing & Utility** | 월세, 공과금 | 🔵 Blue | home |
| **Entertainment** | 취미, 스트리밍 | 🟣 Purple | film |
| **Transport** | 교통, 주유 | 🟢 Green | car |
| **Healthcare** | 병원, 약국 | 🔴 Red | heart-pulse |
| **Education** | 교육, 도서 | 🔵 Cyan | graduation-cap |
| **Finance** | 금융, 투자 | 🟡 Yellow | landmark |

---

## 🔥 핵심 기술 스택

### 백엔드
- **FastAPI** - 고성능 비동기 웹 프레임워크
- **OpenAI GPT-4o-mini** - Structured Outputs로 100% 스키마 준수
- **Pydantic** - 타입 안전 데이터 검증

### 프론트엔드
- **React 18** - 선언적 UI
- **Three.js** - WebGL 3D 렌더링
- **React Three Fiber** - React용 Three.js 래퍼
- **@react-three/drei** - Three.js 헬퍼 컴포넌트
- **Vite** - 번개 빠른 빌드 도구

---

## 🚀 상용화 로드맵

### Phase 1: MVP (현재)
- [x] AI 분류 엔진 구현
- [x] 3D 파티클 시스템
- [x] REST API

### Phase 2: Production Ready
- [ ] Redis 캐싱 구현
- [ ] PostgreSQL 데이터베이스 연동
- [ ] 사용자 인증 (JWT)
- [ ] 실시간 은행 API 연동 (Tink, Plaid)

### Phase 3: Advanced Features
- [ ] Kafka 이벤트 스트리밍
- [ ] WebSocket 실시간 업데이트
- [ ] AI 모델 파인튜닝
- [ ] 모바일 앱 (React Native)

---

## 🧪 테스트

### 백엔드 테스트
```bash
cd backend
pytest
```

### 프론트엔드 빌드
```bash
cd frontend
npm run build
```

---

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트는 상용화를 목표로 하며, 라이선스는 추후 결정됩니다.

---

## 🙏 크레딧

- **OpenAI** - GPT-4o Structured Outputs
- **Three.js** - 3D 렌더링 엔진
- **Pmndrs** - React Three Fiber 생태계

---

## 📞 문의

프로젝트에 대한 문의사항이나 협업 제안은 이슈를 생성해주세요.

---

**Made with ❤️ for the future of financial visualization**
