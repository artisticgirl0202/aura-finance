# Aura Finance Backend — Render 배포 가이드

## 시작 명령어 (Start Command)

Render.com에서 백엔드를 실행할 때 아래 명령어를 **Start Command**로 설정하세요.

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

또는 `python main.py`로 실행해도 됩니다 (코드에서 `PORT` 환경 변수를 자동으로 읽음).

```bash
python main.py
```

> `python main.py`는 `ENV=development`일 때만 `reload=True`가 적용됩니다. 프로덕션에서는 `uvicorn` 직접 실행을 권장합니다.

## 필수 환경 변수 (Render → Environment)

| 변수 | 설명 | 예시 |
|------|------|------|
| `PORT` | Render가 자동 주입. 수동 설정 불필요 | (자동) |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 (쉼표 구분) | `https://your-app.vercel.app,https://www.your-domain.com` |
| `SECRET_KEY` | JWT 암호화용 시크릿 | `openssl rand -hex 32` 로 생성 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql+asyncpg://user:pass@host/db` |
| `OPENAI_API_KEY` 또는 `GEMINI_API_KEY` | AI 분류용 API 키 | (필요 시) |

## CORS 설정

- `ALLOWED_ORIGINS`: `https://your-app.vercel.app` 형식으로 Vercel 프론트엔드 URL 추가
- 여러 도메인: 쉼표로 구분 (`https://app1.vercel.app,https://app2.vercel.app`)
- `FRONTEND_URL`: 단일 URL인 경우 `ALLOWED_ORIGINS` 대신 사용 가능
