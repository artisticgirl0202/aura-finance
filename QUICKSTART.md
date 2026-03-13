# ⚡ Aura Finance - 5분 빠른 시작 가이드

이 가이드를 따라하면 **5분 안에** Aura Finance를 실행할 수 있습니다.

---

## 📋 준비물

- [x] Node.js 18+ 설치됨
- [x] Python 3.10+ 설치됨
- [x] OpenAI API 키 ([여기서 발급](https://platform.openai.com/api-keys))

---

## 🚀 Step 1: 백엔드 실행 (2분)

```bash
# 1. 백엔드 폴더로 이동
cd backend

# 2. 의존성 설치
pip install -r requirements.txt

# 3. 환경 변수 파일 생성
cp env.example .env

# 4. .env 파일 열고 API 키 입력
# Windows: notepad .env
# Mac/Linux: nano .env

# 다음과 같이 입력:
OPENAI_API_KEY=sk-your-actual-key-here

# 5. 서버 실행
python main.py
```

✅ **"Uvicorn running on http://0.0.0.0:8000"** 메시지가 보이면 성공!

---

## 🎨 Step 2: 프론트엔드 실행 (2분)

**새 터미널 창을 열고:**

```bash
# 1. 프론트엔드 폴더로 이동
cd frontend

# 2. 의존성 설치
npm install

# 3. 환경 변수 파일 생성
cp env.example .env

# 4. 개발 서버 실행
npm run dev
```

✅ 브라우저가 자동으로 열리고 3D 도시가 보이면 성공!

---

## 🎮 Step 3: 테스트 (1분)

1. 왼쪽 패널에서 **"⚡ 샘플 거래 테스트"** 버튼 클릭

2. 화면에서 파티클이 중앙에서 각 구역으로 날아가는 것을 확인

3. 직접 테스트하려면:
   - 가맹점 이름: `STARBUCKS SEOUL`
   - 거래 금액: `5.5`
   - **"🔍 AI 분류 실행"** 클릭

---

## 🎉 완료!

이제 다음을 테스트해보세요:

### 🌍 글로벌 브랜드
- `STARBUCKS` → Food & Cafe
- `NETFLIX.COM` → Entertainment
- `AMAZON` → Shopping

### 🇰🇷 한국 서비스
- `스타벅스 서울` → Food & Cafe
- `카카오택시` → Transport
- `쿠팡` → Shopping

### 💳 복잡한 결제 코드
- `AWS*USAGE` → Finance
- `TFL.GOV.UK LONDON` → Transport
- `SP*SPOTIFY` → Entertainment

---

## 🐛 문제 해결

### 백엔드가 안 켜져요
```bash
# Python 버전 확인
python --version  # 3.10 이상이어야 함

# OpenAI 패키지 재설치
pip install --upgrade openai
```

### 프론트엔드가 안 켜져요
```bash
# Node 버전 확인
node --version  # 18 이상이어야 함

# 캐시 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

### API 키가 안 먹혀요
- `.env` 파일이 `backend/` 폴더 안에 있는지 확인
- API 키에 따옴표 없이 입력했는지 확인
- OpenAI 계정에 크레딧이 있는지 확인

---

## 📚 다음 단계

- 상세 문서: [README.md](README.md)
- 백엔드 API: http://localhost:8000/docs
- 프론트엔드: http://localhost:3000

---

**즐거운 개발 되세요! 🚀**
