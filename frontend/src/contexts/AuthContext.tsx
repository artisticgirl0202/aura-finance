/**
 * Aura Finance — Auth Context
 * ────────────────────────────────────────────────────────────────
 * Provides global authentication state across the entire app.
 *
 * Features:
 *  - JWT auto-restore from localStorage on mount
 *  - Token refresh (called automatically before expiry)
 *  - Guest mode (no account needed for demo)
 *  - Typed UserProfile + isAuthenticated + isGuest flags
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AuthUser,
  UserProfile,
  authLogin,
  authMe,
  authRefresh,
  authRegister,
  authLogout as clearTokens,
  tokenStore,
  fetchUserSettings,
} from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegisterParams {
  email:          string;
  password:       string;
  display_name:   string;
  currency?:      string;
  monthly_income?: number;
}

interface AuthContextValue {
  user:            UserProfile | null;
  isAuthenticated: boolean;     // true = real JWT user
  isGuest:         boolean;     // true = no account, demo mode
  isLoading:       boolean;
  login:           (email: string, password: string) => Promise<void>;
  register:        (params: RegisterParams) => Promise<void>;
  continueAsGuest: () => void;
  logout:          () => void;
  updateProfile:   (patch: Partial<UserProfile>) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);   // checking localStorage on mount
  const [isGuest,   setIsGuest]   = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-refresh 25 min after token issued (token expires at 30 min) ──────
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const ok = await authRefresh();
      if (ok) scheduleRefresh();
      else {
        setUser(null);
        setIsGuest(false);
      }
    }, 25 * 60 * 1000);
  }, []);

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const token = tokenStore.getAccess();
      const cached = tokenStore.getUser() as AuthUser | null;

      if (!token) {
        setIsLoading(false);
        return;
      }

      // Guest mode — no authMe, no refresh
      if (tokenStore.isGuest()) {
        setIsGuest(true);
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        // Use cached user data immediately for fast render, then verify
        if (cached) {
          setUser({
            id:             cached.user_id,
            email:          cached.email,
            display_name:   cached.display_name,
            currency:       'USD',
            monthly_income: 0,
            tink_user_id:   null,
            created_at:     '',
          });
        }

        // Verify token is still valid by fetching fresh profile
        const profile = await authMe();
        setUser(profile);
        scheduleRefresh();

        // 로그인 직후 user-settings 로드 (404 방지 — try-catch로 조용히 기본값 사용)
        try {
          await fetchUserSettings();
        } catch {
          // 에러 시 기본값 사용, 콘솔 스팸 없음
        }
      } catch {
        // Token expired — try refresh
        const ok = await authRefresh();
        if (ok) {
          try {
            const profile = await authMe();
            setUser(profile);
            scheduleRefresh();
            try { await fetchUserSettings(); } catch { /* 조용히 기본값 */ }
          } catch {
            tokenStore.clear();
          }
        } else {
          tokenStore.clear();
        }
      } finally {
        setIsLoading(false);
      }
    };

    restore();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const authUser = await authLogin(email, password);
    const profile  = await authMe();
    setUser(profile);
    setIsGuest(false);
    scheduleRefresh();
    tokenStore.set(authUser.access_token, authUser.refresh_token, authUser);
    try {
      await fetchUserSettings();
    } catch {
      // 404 등 에러 시 조용히 기본값 사용, 앱 중단 없음
    }
  }, [scheduleRefresh]);

  const register = useCallback(async (params: RegisterParams) => {
    const authUser = await authRegister(params);
    const profile  = await authMe();
    setUser(profile);
    setIsGuest(false);
    scheduleRefresh();
    tokenStore.set(authUser.access_token, authUser.refresh_token, authUser);
    try {
      await fetchUserSettings();
    } catch {
      // 404 등 에러 시 조용히 기본값 사용
    }
  }, [scheduleRefresh]);

  const continueAsGuest = useCallback(() => {
    tokenStore.setGuest();
    setIsGuest(true);
    setUser(null);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearTokens();
    setUser(null);
    setIsGuest(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isGuest,
    isLoading,
    login,
    register,
    continueAsGuest,
    logout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
