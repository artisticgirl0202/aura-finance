"""
🏦 Tink Open Banking Service

Tink API를 사용하여 실제 은행 계좌 데이터를 가져옵니다.
- OAuth 2.0 인증
- 계좌 잔고 조회
- 거래 내역 조회
"""

import os
import requests
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Tink API 설정 (환경 변수에서 로드)
TINK_CLIENT_ID = os.getenv("TINK_CLIENT_ID", "").strip() or None
TINK_CLIENT_SECRET = os.getenv("TINK_CLIENT_SECRET", "").strip() or None
TINK_ENVIRONMENT = os.getenv("TINK_ENVIRONMENT", "sandbox").strip().lower()
TINK_API_URL = os.getenv("TINK_API_URL", "https://api.tink.com").strip()
TINK_LINK_URL = os.getenv("TINK_LINK_URL", "https://link.tink.com").strip()


class TinkService:
    """Tink API 통합 서비스"""

    def __init__(self):
        if not TINK_CLIENT_ID or not TINK_CLIENT_SECRET:
            raise ValueError("Tink credentials not found in environment variables")

        self.client_id = TINK_CLIENT_ID
        self.client_secret = TINK_CLIENT_SECRET
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[float] = None

        # 로그로 Client ID 확인 (보안상 앞 10자리만)
        logger.info(f"🔑 Tink Service initialized with Client ID: {self.client_id[:10]}...")

    async def get_client_access_token(self) -> str:
        """
        클라이언트 자격 증명으로 액세스 토큰 획득
        (서버-to-서버 호출용)
        """
        if self.access_token and self.token_expires_at and time.time() < self.token_expires_at:
            return self.access_token

        url = f"{TINK_API_URL}/api/v1/oauth/token"

        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": "user:create"
        }

        try:
            response = requests.post(url, data=data, timeout=10)
            response.raise_for_status()

            result = response.json()
            self.access_token = result["access_token"]
            expires_in = result.get("expires_in", 3600)
            self.token_expires_at = time.time() + expires_in

            logger.info("✅ Client access token obtained")
            return self.access_token

        except Exception as e:
            logger.error(f"❌ Failed to get client access token: {e}")
            raise

    async def create_temporary_user(self, external_user_id: str) -> Dict:
        """
        Tink 임시 사용자 생성
        (각 사용자마다 고유한 Tink 사용자 ID 필요)
        """
        token = await self.get_client_access_token()

        url = f"{TINK_API_URL}/api/v1/user/create"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        data = {
            "external_user_id": external_user_id,
            "market": "US",  # or "GB", "SE" etc.
            "locale": "en_US"
        }

        try:
            response = requests.post(url, json=data, headers=headers, timeout=10)

            # 409 Conflict는 사용자가 이미 존재한다는 의미
            if response.status_code == 409:
                logger.info(f"ℹ️ User already exists: {external_user_id}")
                # 기존 사용자 ID 반환 (external_user_id를 user_id로 사용)
                return {
                    "user_id": external_user_id,
                    "external_user_id": external_user_id
                }

            response.raise_for_status()

            result = response.json()
            logger.info(f"✅ Tink user created: {result.get('user_id')}")
            return result

        except requests.exceptions.HTTPError as e:
            if e.response.status_code != 409:
                logger.error(f"❌ Failed to create Tink user: {e}")
                raise
        except Exception as e:
            logger.error(f"❌ Failed to create Tink user: {e}")
            raise

    async def generate_auth_link(
        self,
        user_id: str,
        redirect_uri: str,
        market: str = "SE",  # SE (스웨덴) 유지
        locale: str = "en_US"
    ) -> str:
        """
        Tink Link 인증 URL 생성 (Sandbox 모드)
        
        사용자가 이 링크로 이동하면 은행 선택 및 로그인 화면이 표시됩니다.
        """
        import urllib.parse

        # Scopes 정의
        scopes = [
            "accounts:read",
            "transactions:read",
            "user:read",
            "credentials:read"
        ]

        # Tink Link URL 파라미터
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": ",".join(scopes),
            "market": market,
            "locale": locale,
            "test": "true",  # 🔑 Sandbox 모드 활성화 (필수!)
            "state": user_id  # Callback에서 사용자 식별용
        }

        # URL 생성 (authorize 엔드포인트 사용)
        query_string = urllib.parse.urlencode(params)
        auth_url = f"{TINK_LINK_URL}/1.0/authorize/?{query_string}"

        logger.info(f"✅ Auth link generated (Sandbox Mode) for user: {user_id}")
        return auth_url

    async def exchange_code_for_token(
        self,
        authorization_code: str,
        redirect_uri: str
    ) -> Dict:
        """
        인증 코드를 사용자 액세스 토큰으로 교환
        
        Tink OAuth2는 Form Data 본문에 client_id와 client_secret을 요구합니다.
        """
        url = f"{TINK_API_URL}/api/v1/oauth/token"

        # Authorization 헤더는 삭제하고 Content-Type만 유지합니다.
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }

        # data 안에 client_id와 client_secret을 직접 넣습니다.
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,          # 추가됨
            "client_secret": self.client_secret   # 추가됨
        }

        try:
            logger.info(f"🔄 Exchanging auth code for token (redirect_uri: {redirect_uri})")
            response = requests.post(url, data=data, headers=headers, timeout=10)
            response.raise_for_status()

            result = response.json()
            logger.info("✅ User access token obtained successfully")
            return result

        except requests.exceptions.HTTPError as e:
            # HTTP 에러 상세 로그
            error_detail = e.response.text if hasattr(e.response, 'text') else str(e)
            logger.error(f"❌ Token exchange failed (HTTP {e.response.status_code}): {error_detail}")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to exchange code: {e}")
            raise

    def exchange_code_for_token_sync(
        self, authorization_code: str, redirect_uri: str
    ) -> Dict:
        """Sync version for run_in_executor (avoids blocking event loop)."""
        url = f"{TINK_API_URL}/api/v1/oauth/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        response = requests.post(url, data=data, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()

    def get_transactions_sync(
        self, user_access_token: str, account_id: Optional[str] = None, days: int = 30
    ) -> List[Dict]:
        """Sync version for run_in_executor."""
        url = f"{TINK_API_URL}/data/v2/transactions"
        headers = {"Authorization": f"Bearer {user_access_token}"}
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        params = {"pageSize": 100, "from": start_date.isoformat(), "to": end_date.isoformat()}
        if account_id:
            params["accountIdIn"] = account_id
        response = requests.get(url, headers=headers, params=params, timeout=15)
        response.raise_for_status()
        return response.json().get("transactions", [])

    async def get_accounts(self, user_access_token: str) -> List[Dict]:
        """
        사용자의 연결된 은행 계좌 목록 조회
        """
        url = f"{TINK_API_URL}/data/v2/accounts"

        headers = {
            "Authorization": f"Bearer {user_access_token}"
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            result = response.json()
            accounts = result.get("accounts", [])

            logger.info(f"✅ Retrieved {len(accounts)} accounts")
            return accounts

        except Exception as e:
            logger.error(f"❌ Failed to get accounts: {e}")
            raise

    async def get_transactions(
        self,
        user_access_token: str,
        account_id: Optional[str] = None,
        days: int = 30
    ) -> List[Dict]:
        """
        거래 내역 조회
        
        Args:
            user_access_token: 사용자 액세스 토큰
            account_id: 특정 계좌 ID (없으면 모든 계좌)
            days: 조회할 기간 (일)
        """
        url = f"{TINK_API_URL}/data/v2/transactions"

        headers = {
            "Authorization": f"Bearer {user_access_token}"
        }

        # 날짜 필터
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        params = {
            "pageSize": 100,
            "from": start_date.isoformat(),
            "to": end_date.isoformat()
        }

        if account_id:
            params["accountIdIn"] = account_id

        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()

            result = response.json()
            transactions = result.get("transactions", [])

            logger.info(f"✅ Retrieved {len(transactions)} transactions")
            return transactions

        except Exception as e:
            logger.error(f"❌ Failed to get transactions: {e}")
            raise


# 싱글톤 인스턴스
tink_service = TinkService()
