"""
Aura Finance — Email Service (Gmail SMTP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

비밀번호 재설정 등 트랜잭션 이메일 발송.
Python 표준 라이브러리(smtplib, email.mime) 사용.
환경 변수: MAIL_USERNAME, MAIL_PASSWORD, FRONTEND_URL

Render 등 클라우드: IPv6 비활성화, 포트 465/587 Fallback, 타임아웃 10초
"""

import asyncio
import logging
import os
import socket
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT_SSL = 465  # SSL/TLS (Render에서 587 차단 시 사용)
SMTP_PORT_STARTTLS = 587  # STARTTLS (fallback)
SMTP_TIMEOUT = 10  # 네트워크 타임아웃 (초) — 무한 대기 방지

MAIL_USERNAME = os.getenv("MAIL_USERNAME", "").strip()
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


# ── IPv4 강제 (Render 등 IPv6 라우팅 불가 환경 대응) ───────────────────────
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(*args: object, **kwargs: object) -> list:
    """IPv6 결과 제거 — IPv4(AF_INET)만 반환"""
    results = _orig_getaddrinfo(*args, **kwargs)
    return [r for r in results if r[0] == socket.AF_INET]


socket.getaddrinfo = _ipv4_only_getaddrinfo


def _build_reset_email_html(reset_url: str) -> str:
    """비밀번호 재설정 이메일 HTML 본문"""
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비밀번호 재설정</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0f0f14; color:#e0e0e0;">
  <div style="max-width:560px; margin:40px auto; padding:32px; background:linear-gradient(135deg, rgba(30,30,45,0.95) 0%, rgba(20,20,35,0.98) 100%); border-radius:16px; border:1px solid rgba(100,200,255,0.2);">
    <h1 style="margin:0 0 24px; font-size:22px; font-weight:600; color:#64c8ff;">
      [Aura Finance] 비밀번호 재설정 안내
    </h1>
    <p style="margin:0 0 16px; line-height:1.6; color:#b0b0b8;">
      안녕하세요. Aura Finance를 이용해 주셔서 감사합니다.
    </p>
    <p style="margin:0 0 24px; line-height:1.6; color:#b0b0b8;">
      비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
    </p>
    <p style="margin:0 0 24px;">
      <a href="{reset_url}" style="display:inline-block; padding:14px 28px; background:linear-gradient(135deg, #64c8ff 0%, #4a9fd4 100%); color:#0a0a12; text-decoration:none; font-weight:600; border-radius:8px;">
        비밀번호 재설정하기
      </a>
    </p>
    <p style="margin:0; font-size:13px; color:#808090;">
      링크는 15분간 유효합니다. 요청하지 않으셨다면 이 메일을 무시해 주세요.
    </p>
    <hr style="margin:24px 0; border:none; border-top:1px solid rgba(100,200,255,0.15);">
    <p style="margin:0; font-size:12px; color:#606070;">
      © Aura Finance. All rights reserved.
    </p>
  </div>
</body>
</html>
""".strip()


def _send_sync(to_email: str, reset_token: str) -> None:
    """
    Gmail SMTP 동기 발송 (이벤트 루프 블로킹 방지를 위해 asyncio.to_thread에서 호출)
    - IPv4 강제 (모듈 로드 시 getaddrinfo 몽키패치)
    - 465(SSL) 우선, 실패 시 587(STARTTLS) Fallback
    - 타임아웃 10초로 무한 대기 방지
    """
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        raise ValueError("MAIL_USERNAME and MAIL_PASSWORD must be set in .env")

    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    html_content = _build_reset_email_html(reset_url)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[Aura Finance] 비밀번호 재설정 안내"
    msg["From"] = f"Aura Finance <{MAIL_USERNAME}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    last_error: Exception | None = None

    # 1) 465 SSL/TLS 시도 (Render 등에서 587 차단 시 사용)
    try:
        with smtplib.SMTP_SSL(
            SMTP_HOST, SMTP_PORT_SSL, timeout=SMTP_TIMEOUT
        ) as server:
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_USERNAME, to_email, msg.as_string())
        return
    except Exception as e:
        last_error = e
        logger.warning(
            "SMTP 465 (SSL) failed for %s: %s — falling back to 587 (STARTTLS)",
            to_email,
            e,
        )

    # 2) 587 STARTTLS Fallback
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT_STARTTLS, timeout=SMTP_TIMEOUT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_USERNAME, to_email, msg.as_string())
        return
    except Exception as e:
        last_error = e
        logger.warning("SMTP 587 (STARTTLS) also failed for %s: %s", to_email, e)

    raise last_error or RuntimeError("SMTP send failed")


async def send_password_reset_email(to_email: str, reset_token: str) -> None:
    """
    비밀번호 재설정 이메일을 비동기로 발송.
    smtplib는 블로킹이므로 asyncio.to_thread로 실행.
    """
    await asyncio.to_thread(_send_sync, to_email, reset_token)
