/**
 * 🚀 Aura Finance - API Client
 * 
 * 백엔드 FastAPI 서버와 통신하는 중앙 모듈
 * 상용화를 위한 타임아웃, 에러 핸들링, 인터셉터 포함
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// 환경 변수에서 API URL 가져오기 (개발/프로덕션 자동 전환)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Axios 인스턴스 생성
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000, // 10초 타임아웃 (AI 분류는 시간이 걸릴 수 있음)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── JWT token storage ─────────────────────────────────────────────────────
const TOKEN_KEY   = 'aura_access_token';
const REFRESH_KEY = 'aura_refresh_token';
const USER_KEY    = 'aura_user';

/** Guest mode token — backend returns mock data, blocks mutations */
export const GUEST_TOKEN = 'guest-token';

export const tokenStore = {
  getAccess:  ()    => localStorage.getItem(TOKEN_KEY),
  getRefresh: ()    => localStorage.getItem(REFRESH_KEY),
  getUser:    ()    => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  set: (access: string, refresh: string, user: object) => {
    localStorage.setItem(TOKEN_KEY,   access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY,    JSON.stringify(user));
    localStorage.removeItem('aura_guest'); // clear guest flag when real login
  },
  /** Set guest mode — stores guest-token so API receives Bearer guest-token */
  setGuest: () => {
    localStorage.setItem(TOKEN_KEY, GUEST_TOKEN);
    localStorage.setItem('aura_guest', '1');
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isGuest: () => localStorage.getItem(TOKEN_KEY) === GUEST_TOKEN || localStorage.getItem('aura_guest') === '1',
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('aura_guest');
  },
};

/**
 * 요청 인터셉터 — JWT 자동 첨부
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStore.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * 응답 인터셉터 (에러 처리, 로깅)
 */
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`, response.data);
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ Response Error:', error.message);
    
    if (error.response) {
      // 서버가 응답했지만 에러 상태 코드
      console.error('Server Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // 요청은 보냈지만 응답 없음
      console.error('No Response from Server');
    } else {
      // 요청 설정 중 에러
      console.error('Request Setup Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// ==========================================
// API 함수들
// ==========================================

/**
 * 거래 데이터 타입
 */
export interface TransactionInput {
  description: string;
  amount?: number;
  currency?: string;
}

/**
 * AI 분류 결과 타입
 */
export interface ClassificationResult {
  district: string;
  confidence: number;
  reason: string;
  icon: string;
  color: string;
}

/**
 * 도시 구역 정보 타입
 */
export interface District {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * 🤖 단일 거래 분류
 * 
 * @param description - 가맹점 이름
 * @param amount - 거래 금액 (선택)
 * @param currency - 통화 코드 (선택)
 * @returns AI 분류 결과
 */
export const classifyTransaction = async (
  description: string,
  amount: number = 0,
  currency: string = 'USD'
): Promise<ClassificationResult> => {
  const response = await apiClient.post<ClassificationResult>('/classify', {
    description,
    amount,
    currency,
  });
  
  return response.data;
};

/**
 * 📦 여러 거래 일괄 분류
 * 
 * @param transactions - 거래 목록
 * @returns AI 분류 결과 배열
 */
export const classifyBatch = async (
  transactions: TransactionInput[]
): Promise<ClassificationResult[]> => {
  const response = await apiClient.post<ClassificationResult[]>('/classify/batch', transactions);
  return response.data;
};

/**
 * 🏙️ 도시 구역 목록 가져오기
 * 
 * @returns 구역 정보 배열
 */
export const fetchDistricts = async (): Promise<District[]> => {
  const response = await apiClient.get<{ districts: District[] }>('/districts');
  return response.data.districts;
};

/**
 * 🏥 서버 헬스체크
 * 
 * @returns 서버 상태
 */
export const healthCheck = async (): Promise<{ status: string; version: string }> => {
  const response = await axios.get(`${API_BASE_URL}/`);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Transaction DB API  (persisted history)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbTransaction {
  id:            string;
  description:   string;
  amount:        number;
  currency:      string;
  type:          string;
  district:      string;
  confidence:    number;
  reason:        string | null;
  icon:          string | null;
  color:         string | null;
  ai_engine:     string | null;
  source:        string;
  is_anomaly:    boolean;
  anomaly_score: number | null;
  anomaly_type:  string | null;
  tx_timestamp:  string | null;
  created_at:    string | null;
}

export interface TransactionListResponse {
  total:  number;
  limit:  number;
  offset: number;
  data:   DbTransaction[];
}

export interface DistrictStats {
  district:   string;
  total:      number;
  count:      number;
  avg_amount: number;
  last_tx:    string | null;
}

export interface BudgetInput {
  district:      string;
  budget_type?:  string;
  monthly_limit: number;
  period_month?: string;
  user_id?:      string;
}

/**
 * 📋 Fetch persisted transaction history from DB
 */
export const fetchTransactionHistory = async (params?: {
  tx_type?:    string;
  district?:   string;
  source?:     string;
  search?:     string;
  is_anomaly?: boolean;
  limit?:      number;
  offset?:     number;
  user_id?:    string;
}): Promise<TransactionListResponse> => {
  const response = await apiClient.get<TransactionListResponse>('/transactions', { params });
  return response.data;
};

/**
 * 📊 Spending totals by district (for pie chart + 3D building heights)
 */
export const fetchDistrictStats = async (params?: {
  user_id?: string;
  tx_type?: string;
}): Promise<DistrictStats[]> => {
  const response = await apiClient.get<DistrictStats[]>('/transactions/stats/by-district', { params });
  return response.data;
};

/**
 * 📈 Daily spending time-series (for trend charts)
 */
export const fetchTimeSeries = async (params?: {
  user_id?:  string;
  district?: string;
  days?:     number;
}): Promise<{ day: string; district: string; total: number; count: number }[]> => {
  const response = await apiClient.get('/transactions/stats/time-series', { params });
  return response.data;
};

/**
 * 🚨 Anomalous transactions (fraud detection feed)
 */
export const fetchAnomalies = async (params?: {
  user_id?: string;
  limit?:   number;
}): Promise<DbTransaction[]> => {
  const response = await apiClient.get<DbTransaction[]>('/transactions/stats/anomalies', { params });
  return response.data;
};

/**
 * 📊 Analytics overview (budget vs actual, M4 trend, M6 advice)
 */
export const fetchAnalyticsOverview = async (params?: { limit?: number }) => {
  const response = await apiClient.get('/analytics/overview', { params });
  return response.data;
};

/**
 * 🔔 Phase 3: AI Smart Alerts (경고/칭찬 인사이트)
 */
export const fetchAnalyticsInsights = async (params?: { limit?: number }) => {
  const response = await apiClient.get<{ insights: AnalyticsInsight[]; updated_at: string }>('/analytics/insights', { params });
  return response.data;
};

export interface AnalyticsInsight {
  id: string;
  type: 'warning' | 'praise';
  title: string;
  message: string;
  priority: string;
  icon: string;
  created_at: string;
}

/**
 * 🎯 Goal-specific forecast (RAG advice + SHAP contributions)
 */
export const fetchGoalForecast = async (goalId: string) => {
  const response = await apiClient.get(`/analytics/goals/${goalId}/forecast`);
  return response.data;
};

/**
 * 🧠 Full AI pipeline analysis (M1-M6) from DB history
 */
export const fetchFullAnalysis = async (params?: {
  user_id?:        string;
  income_monthly?: number;
  limit?:          number;
}) => {
  const response = await apiClient.get('/transactions/analysis/full', { params });
  return response.data;
};

/**
 * 💾 Save a budget limit to DB
 */
export const saveBudget = async (budget: BudgetInput) => {
  const response = await apiClient.post('/budgets', budget);
  return response.data;
};

/**
 * 💰 Fetch budget limits from DB
 */
export const fetchBudgets = async (params?: {
  user_id?:      string;
  period_month?: string;
}) => {
  const response = await apiClient.get('/budgets', { params });
  return response.data;
};

/**
 * 📦 Classify + persist batch (Tink bank import → 1 Gemini call → DB)
 */
export const batchClassifyAndSave = async (
  transactions: Array<{
    description:  string;
    amount?:      number;
    currency?:    string;
    tx_type?:     string;
    source?:      string;
    tink_id?:     string;
    user_id?:     string;
    tx_timestamp?: string;
  }>
): Promise<DbTransaction[]> => {
  const response = await apiClient.post<DbTransaction[]>(
    '/transactions/batch-classify-and-save',
    transactions
  );
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id:      string;
  email:        string;
  display_name: string;
  access_token:  string;
  refresh_token: string;
}

export interface UserProfile {
  id:             string;
  email:          string;
  display_name:   string;
  currency:       string;
  monthly_income: number;
  tink_user_id:   string | null;
  created_at:     string;
}

export const authRegister = async (params: {
  email: string; password: string; display_name: string;
  currency?: string; monthly_income?: number;
}): Promise<AuthUser> => {
  const res = await apiClient.post('/auth/register', params);
  const d = res.data;
  tokenStore.set(d.access_token, d.refresh_token, d);
  return d;
};

export const authLogin = async (email: string, password: string): Promise<AuthUser> => {
  const res = await apiClient.post('/auth/login', { email, password });
  const d = res.data;
  tokenStore.set(d.access_token, d.refresh_token, d);
  return d;
};

export const authRefresh = async (): Promise<boolean> => {
  const refresh_token = tokenStore.getRefresh();
  if (!refresh_token) return false;
  try {
    const res = await apiClient.post('/auth/refresh', { refresh_token });
    const d = res.data;
    tokenStore.set(d.access_token, d.refresh_token, d);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
};

export const authMe = async (): Promise<UserProfile> => {
  const res = await apiClient.get('/auth/me');
  return res.data;
};

export interface UserSettings {
  theme: string;
  currency: string;
  language: string;
}

/** 기본 사용자 설정 (API 실패 시 폴백) */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'dark',
  currency: 'USD',
  language: 'en',
};

/**
 * 사용자 설정 조회. 실패 시 기본값 반환 (try-catch는 호출 측에서 처리).
 */
export const fetchUserSettings = async (): Promise<UserSettings> => {
  const res = await apiClient.get<UserSettings>('/user-settings');
  return res.data;
};

export const authUpdateProfile = async (params: {
  display_name?: string; currency?: string; monthly_income?: number;
}): Promise<UserProfile> => {
  const res = await apiClient.put('/auth/me', params);
  return res.data;
};

export const authLogout = () => tokenStore.clear();

/**
 * 비밀번호 재설정 요청 (User enumeration 방지 — 항상 200)
 */
export const authForgotPassword = async (email: string): Promise<{ message: string }> => {
  const res = await apiClient.post('/auth/forgot-password', { email });
  return res.data;
};

/**
 * 비밀번호 재설정 실행 (token + new_password)
 */
export const authResetPassword = async (token: string, newPassword: string): Promise<{ message: string }> => {
  const res = await apiClient.post('/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return res.data;
};

/**
 * 🔐 비밀번호 변경 (마이페이지 Security)
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiClient.put('/auth/change-password', {
    current_password: currentPassword,
    new_password:     newPassword,
  });
};

/**
 * 🏦 은행 연결 해제 (마이페이지 Connections)
 */
export const disconnectBank = async (): Promise<void> => {
  await apiClient.post('/banking/disconnect');
  localStorage.removeItem('tink_access_token');
  sessionStorage.removeItem('tink_access_token');
};

/**
 * ↻ 은행 데이터 수동 동기화 (마이페이지 Connections)
 */
export const syncBankData = async (): Promise<{ synced_count: number }> => {
  const res = await apiClient.post<{ message: string; synced_count: number }>('/banking/sync');
  return { synced_count: res.data.synced_count ?? 0 };
};

/**
 * 📥 내 금융 데이터 내보내기 (마이페이지 Danger Zone)
 */
export const exportUserData = async (): Promise<Blob> => {
  const res = await apiClient.get('/auth/export-data', { responseType: 'blob' });
  return res.data;
};

/**
 * 🗑 회원 탈퇴 (마이페이지 Danger Zone — 2차 확인 후 호출)
 */
export const deleteAccount = async (password: string): Promise<void> => {
  await apiClient.post('/auth/delete-account', { password });
  tokenStore.clear();
};


// ─────────────────────────────────────────────────────────────────────────────
// Goals API
// ─────────────────────────────────────────────────────────────────────────────

export interface GoalProgress {
  goal_id:            string;
  goal_name:          string;
  goal_type:          string;
  target_amount:      number;
  current_amount:     number;
  progress_pct:       number;
  remaining:          number;
  status:             string;
  days_left:          number | null;
  daily_budget:       number | null;
  on_track:           boolean;
  trend:              'ahead' | 'on_track' | 'at_risk' | 'exceeded' | 'achieved';
  ai_forecast:        string | null;
  transactions_count: number;
  period_label:       string;
}

export interface Goal {
  id:            string;
  name:          string;
  description:   string | null;
  goal_type:     string;
  target_amount: number;
  district:      string | null;
  period_type:   string;
  period_month:  string | null;
  target_date:   string | null;
  icon:          string;
  color:         string;
  status:        string;
  created_at:    string | null;
  progress?:     GoalProgress;
}

export interface GoalCreate {
  name:           string;
  description?:   string;
  goal_type:      'expense_limit' | 'savings' | 'income_target' | 'investment' | 'net_worth';
  target_amount:  number;
  district?:      string;
  period_type?:   'monthly' | 'annual' | 'one_time';
  period_month?:  string;
  target_date?:   string;
  icon?:          string;
  color?:         string;
}

export interface GoalDashboard {
  total_goals:     number;
  active_goals:    number;
  achieved_goals:  number;
  at_risk_goals:   number;
  goals:           Goal[];
  ai_advice:       any[];
  portfolio_score: number | null;
  savings_rate:    number | null;
}

export const createGoal = async (goal: GoalCreate): Promise<Goal> => {
  const res = await apiClient.post('/goals', goal);
  return res.data;
};

export const listGoals = async (status?: string): Promise<{ total: number; goals: Goal[] }> => {
  const res = await apiClient.get('/goals', { params: status ? { status } : undefined });
  return res.data;
};

export const getGoal = async (goalId: string): Promise<Goal> => {
  const res = await apiClient.get(`/goals/${goalId}`);
  return res.data;
};

export const updateGoal = async (goalId: string, updates: Partial<GoalCreate & { status: string }>): Promise<Goal> => {
  const res = await apiClient.put(`/goals/${goalId}`, updates);
  return res.data;
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  await apiClient.delete(`/goals/${goalId}`);
};

export const getGoalProgress = async (goalId: string): Promise<GoalProgress> => {
  const res = await apiClient.get(`/goals/${goalId}/progress`);
  return res.data;
};

export const getGoalsDashboard = async (incomMonthly?: number): Promise<GoalDashboard> => {
  const res = await apiClient.get('/goals/dashboard', {
    params: incomMonthly ? { income_monthly: incomMonthly } : undefined,
  });
  return res.data;
};

export const simulateGoal = async (params: {
  goal_type:      string;
  target_amount:  number;
  monthly_income?: number;
  current_pace?:  number;
  months_ahead?:  number;
}) => {
  const res = await apiClient.get('/goals/simulate', { params });
  return res.data;
};

// ── Finance API (Phase 1: balance, transactions, goals progress) ─────────────────

export interface FinanceOverview {
  balance:             number;
  currency:           string;
  recent_transactions: Array<{
    id: string;
    description: string;
    amount: number;
    tx_type: string;
    district: string;
    tx_timestamp: number;
    source: string;
  }>;
  goals_with_progress: Goal[];
  updated_at:          string;
}

export const fetchFinanceOverview = async (): Promise<FinanceOverview> => {
  const res = await apiClient.get('/finance/overview');
  return res.data;
};

export const fetchFinanceBalance = async (): Promise<{ balance: number; currency: string }> => {
  const res = await apiClient.get('/finance/balance');
  return res.data;
};

// Export API client for advanced usage
export default apiClient;
