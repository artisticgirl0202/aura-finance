#!/bin/bash

# 🛑 Aura Finance - 전체 시스템 종료 스크립트

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Stopping Aura Finance Services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# PID 파일에서 프로세스 종료
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Stopping Backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        echo -e "${GREEN}✅ Backend stopped${NC}"
    else
        echo -e "${RED}⚠️  Backend process not found${NC}"
    fi
    rm .backend.pid
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "Stopping Frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    else
        echo -e "${RED}⚠️  Frontend process not found${NC}"
    fi
    rm .frontend.pid
fi

# 포트를 사용하는 프로세스 강제 종료
echo ""
echo "Checking for processes on ports 8000 and 5173..."

if lsof -ti:8000 > /dev/null 2>&1; then
    echo "Killing process on port 8000..."
    kill -9 $(lsof -ti:8000) 2>/dev/null || true
fi

if lsof -ti:5173 > /dev/null 2>&1; then
    echo "Killing process on port 5173..."
    kill -9 $(lsof -ti:5173) 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✅ All services stopped successfully${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
