#!/bin/bash

# 🚀 Aura Finance - 전체 시스템 자동 시작 스크립트
#
# 이 스크립트는 백엔드와 프론트엔드를 동시에 실행합니다.
#
# 사용법:
#   chmod +x START_ALL.sh
#   ./START_ALL.sh

set -e  # 에러 발생 시 즉시 종료

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌆 Aura Finance - Starting All Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 에러 처리 함수
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    exit 1
}

# 1. 환경 체크
echo -e "${YELLOW}📋 Step 1: Checking environment...${NC}"

if ! command -v python3 &> /dev/null; then
    error_exit "Python 3 is not installed. Please install Python 3.10+"
fi

if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed. Please install Node.js 18+"
fi

echo -e "${GREEN}✅ Python and Node.js detected${NC}"
echo ""

# 2. 백엔드 환경 변수 체크
echo -e "${YELLOW}🔑 Step 2: Checking API keys...${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found. Creating from template...${NC}"
    cp backend/env.example backend/.env
    echo -e "${RED}Please edit backend/.env and add your OpenAI API key!${NC}"
    exit 1
fi

# .env 파일에서 API 키 체크
if ! grep -q "OPENAI_API_KEY=sk-" backend/.env; then
    echo -e "${RED}❌ OpenAI API key not found in backend/.env${NC}"
    echo -e "${YELLOW}Please add your API key to backend/.env:${NC}"
    echo "OPENAI_API_KEY=sk-your-key-here"
    exit 1
fi

echo -e "${GREEN}✅ API key configured${NC}"
echo ""

# 3. 백엔드 실행
echo -e "${YELLOW}🔧 Step 3: Starting Backend...${NC}"

cd backend

# 가상환경이 있으면 활성화
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# 의존성 설치 (처음 실행 시)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# 백엔드 실행 (백그라운드)
echo "Starting FastAPI server..."
python main.py > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ..

echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
echo "   Logs: backend.log"
echo "   API: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo ""

# 백엔드가 준비될 때까지 대기
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 4. 프론트엔드 실행
echo -e "${YELLOW}🎨 Step 4: Starting Frontend...${NC}"

cd frontend

# 의존성 설치 (처음 실행 시)
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# 환경 변수 파일 체크
if [ ! -f ".env" ]; then
    cp env.example .env
fi

# 프론트엔드 실행 (백그라운드)
echo "Starting Vite dev server..."
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
echo "   Logs: frontend.log"
echo "   URL: http://localhost:5173"
echo ""

# 5. 완료
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All services are running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Access the app:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📊 Monitor logs:"
echo "   Backend: tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "💡 Tip: Try the sample transactions first!"
echo ""

# PID 저장 (나중에 종료할 수 있도록)
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo "Press Ctrl+C to stop all services..."
echo ""

# 로그 실시간 출력
tail -f backend.log frontend.log
