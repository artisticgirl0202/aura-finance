# 🎨 Aura Finance Frontend - 3D Visualization

**React Three Fiber 기반 금융 데이터 3D 시각화 클라이언트**

---

## 🎯 주요 기능

1. **3D 도시 렌더링**
   - React Three Fiber + Three.js
   - WebGL 기반 고성능 렌더링
   - 실시간 파티클 애니메이션

2. **AI 연동**
   - 백엔드 API와 실시간 통신
   - 분류 결과를 즉시 시각화

3. **사용자 인터페이스**
   - 직관적인 거래 입력 패널
   - 샘플 데모 기능
   - 실시간 거래 카운터

---

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

---

## 🏗️ 프로젝트 구조

```
src/
├── components/
│   └── 3d/
│       ├── CityScene.tsx      # 메인 3D 씬
│       ├── CityDistrict.tsx   # 도시 구역 (건물)
│       └── ParticleSystem.tsx # 파티클 애니메이션
├── hooks/
│   └── useTransactionClassifier.ts  # API 통신 훅
├── App.tsx                    # 메인 애플리케이션
└── main.tsx                   # 진입점
```

---

## 🎨 컴포넌트 설명

### `CityScene.tsx`
- 3D 도시 전체를 관리하는 메인 씬
- 구역 배치 (원형 레이아웃)
- 조명, 카메라, 환경 설정

### `CityDistrict.tsx`
- 각 소비 카테고리를 나타내는 3D 건물
- 호버 애니메이션 (상하 움직임, 회전)
- 포인트 라이트로 발광 효과

### `ParticleSystem.tsx`
- 거래 발생 시 파티클 생성
- 베지어 곡선을 따라 목표 구역으로 이동
- 페이드 아웃 효과

### `useTransactionClassifier.ts`
- 백엔드 API 호출 로직
- 단일/배치 분류 지원
- 거래 상태 관리

---

## 🎮 사용자 조작

- **마우스 드래그**: 카메라 회전
- **마우스 휠**: 줌 인/아웃
- **우클릭 드래그**: 카메라 이동

---

## 🔧 환경 변수

`.env` 파일 생성:
```env
VITE_API_URL=http://localhost:8000
```

---

## 🚀 최적화

- **코드 스플리팅**: Three.js 라이브러리 별도 청크
- **메모이제이션**: `useMemo`로 재계산 방지
- **트랜지션 관리**: 10초 후 파티클 자동 삭제
- **비동기 렌더링**: Suspense로 로딩 처리

---

## 📦 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `react` | UI 프레임워크 |
| `three` | 3D 렌더링 엔진 |
| `@react-three/fiber` | React용 Three.js 래퍼 |
| `@react-three/drei` | Three.js 헬퍼 컴포넌트 |
| `axios` | HTTP 클라이언트 |
| `vite` | 빌드 도구 |

---

## 🎨 커스터마이징

### 색상 변경
`CityDistrict.tsx`에서 각 구역의 색상 정의:
```typescript
const DISTRICT_COLOR_MAP = {
  "Food & Cafe": "#f59e0b",
  "Shopping": "#ec4899",
  // ...
}
```

### 파티클 개수 조정
`ParticleSystem.tsx`:
```typescript
const particleCount = Math.min(Math.max(Math.floor(amount / 10), 10), 100);
```

### 구역 배치 변경
`CityScene.tsx`에서 `radius` 값 조정:
```typescript
const radius = 8; // 구역 간 거리
```

---

## 🐛 트러블슈팅

### 3D가 렌더링되지 않음
- 브라우저가 WebGL을 지원하는지 확인
- GPU 드라이버 업데이트

### API 연결 실패
- 백엔드가 실행 중인지 확인 (`http://localhost:8000`)
- CORS 설정 확인

### 성능 저하
- 파티클 개수 줄이기
- 안티앨리어싱 비활성화

---

## 📱 브라우저 지원

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

**Built with React Three Fiber ⚡**
