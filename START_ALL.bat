@echo off
REM 🚀 Aura Finance - Windows 전체 시스템 자동 시작 스크립트

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🌆 Aura Finance - Starting All Services
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM 1. 환경 체크
echo 📋 Step 1: Checking environment...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: Python is not installed
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed
    exit /b 1
)

echo ✅ Python and Node.js detected
echo.

REM 2. API 키 체크
echo 🔑 Step 2: Checking API keys...
if not exist "backend\.env" (
    echo ⚠️  backend\.env not found. Creating from template...
    copy backend\env.example backend\.env
    echo ❌ Please edit backend\.env and add your OpenAI API key!
    pause
    exit /b 1
)

findstr /C:"OPENAI_API_KEY=sk-" backend\.env >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ OpenAI API key not found in backend\.env
    echo Please add your API key to backend\.env
    pause
    exit /b 1
)

echo ✅ API key configured
echo.

REM 3. 백엔드 실행
echo 🔧 Step 3: Starting Backend...
cd backend

REM 가상환경 생성 (없으면)
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

REM 백엔드 실행 (새 창에서)
echo Starting FastAPI server...
start "Aura Finance Backend" cmd /k "venv\Scripts\activate && python main.py"

cd ..

echo ✅ Backend started
echo    API: http://localhost:8000
echo    Docs: http://localhost:8000/docs
echo.

REM 백엔드 준비 대기
echo Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

REM 4. 프론트엔드 실행
echo 🎨 Step 4: Starting Frontend...
cd frontend

REM 의존성 설치 (없으면)
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM 환경 변수 파일 체크
if not exist ".env" (
    copy env.example .env
)

REM 프론트엔드 실행 (새 창에서)
echo Starting Vite dev server...
start "Aura Finance Frontend" cmd /k "npm run dev"

cd ..

echo ✅ Frontend started
echo    URL: http://localhost:5173
echo.

REM 5. 완료
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ All services are running!
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🌐 Access the app:
echo    Frontend: http://localhost:5173
echo    Backend API: http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo.
echo 💡 Tip: Try the sample transactions first!
echo.
echo 🛑 To stop: Close the Backend and Frontend windows
echo.
pause
