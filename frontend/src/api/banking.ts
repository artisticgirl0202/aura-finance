/**
 * 🏦 Banking API Client
 *
 * Tink Open Banking 연동을 위한 API 함수들
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AuthLinkResponse {
  auth_url: string;
  user_id: string;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export interface BankTransaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  account_id: string;
  ai_district?: string;
  ai_confidence?: number;
  ai_color?: string;
}

/**
 * 🔗 Tink 인증 링크 생성
 */
export async function createAuthLink(userId: string, redirectUri: string = `${window.location.origin}/callback`): Promise<AuthLinkResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/banking/auth/link`, {
    user_id: userId,
    redirect_uri: redirectUri
  });

  return response.data;
}

/**
 * 🔗 은행 연결 통합 (권장)
 * code → 백엔드에서 token 교환 + DB 저장 + 거래 조회 + AI 분류 + DB 저장
 */
export async function connectBank(code: string, redirectUri: string = `${window.location.origin}/callback`): Promise<{
  success: boolean;
  transaction_count: number;
  message: string;
  bank_connection_id?: string;
  access_token?: string;
}> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/banking/connect`, {
    code,
    redirect_uri: redirectUri,
  }, {
    headers: Object.assign(
      {},
      localStorage.getItem('aura_access_token')
        ? { Authorization: `Bearer ${localStorage.getItem('aura_access_token')}` }
        : {}
    ),
  });
  return response.data;
}

/**
 * 🔐 인증 코드를 액세스 토큰으로 교환 (레거시 - connectBank 사용 권장)
 */
export async function exchangeAuthCode(authCode: string, redirectUri: string = `${window.location.origin}/callback`): Promise<TokenResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/v1/banking/auth/token`, {
    authorization_code: authCode,
    redirect_uri: redirectUri
  });

  return response.data;
}

/**
 * 💳 연결된 계좌 목록 조회
 */
export async function getAccounts(accessToken: string): Promise<Account[]> {
  const response = await axios.get(`${API_BASE_URL}/api/v1/banking/accounts`, {
    params: { access_token: accessToken }
  });

  return response.data;
}

/**
 * 📊 거래 내역 조회 + AI 자동 분류
 */
export async function getTransactions(
  accessToken: string,
  accountId?: string,
  days: number = 30,
  classifyWithAi: boolean = true
): Promise<BankTransaction[]> {
  const response = await axios.get(`${API_BASE_URL}/api/v1/banking/transactions`, {
    params: {
      access_token: accessToken,
      account_id: accountId,
      days,
      classify_with_ai: classifyWithAi
    }
  });

  return response.data;
}

/**
 * 🏥 Banking 서비스 헬스체크
 */
export async function bankingHealthCheck(): Promise<any> {
  const response = await axios.get(`${API_BASE_URL}/api/v1/banking/health`);
  return response.data;
}
