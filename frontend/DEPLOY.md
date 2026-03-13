# Aura Finance Frontend — Vercel 배포 가이드

## 환경 변수 (Vercel → Settings → Environment Variables)

| 변수 | 값 | 설명 |
|------|-----|------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Render에 배포된 백엔드 API URL |

> Vite는 `VITE_` 접두사가 있는 변수만 클라이언트에 노출합니다.

## 빌드 설정

- **Build Command**: `npm run build` (기본값)
- **Output Directory**: `dist` (기본값)
- **Root Directory**: `frontend` (모노레포인 경우)

## 로컬 개발

```bash
cp .env.example .env.local
# .env.local 수정: VITE_API_URL=http://localhost:8000
npm run dev
```
