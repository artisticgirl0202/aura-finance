/**
 * Aura Finance — 은행 연동 상태 Store (Zustand Persist)
 * ─────────────────────────────────────────────────────────────────
 * 새로고침 후에도 isBankConnected, hasLoadedDemoData 상태 유지
 * justConnected: 방금 연동 완료 (persist 안 함) → 로딩 UI / 축하 알림 분기
 * hasLoadedDemoData: Tink/데모 데이터 1회 로드 완료 → 새로고침 시 DB만 가볍게 GET
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BankState {
  isBankConnected: boolean;
  justConnected: boolean;
  hasLoadedDemoData: boolean;
  setBankConnected: (v: boolean) => void;
  setJustConnected: (v: boolean) => void;
  setHasLoadedDemoData: (v: boolean) => void;
  /** tink_access_token과 동기화: 토큰 있으면 connected로 간주 */
  syncFromStorage: () => void;
}

export const useBankStore = create<BankState>()(
  persist(
    (set) => ({
      isBankConnected: false,
      justConnected: false,
      hasLoadedDemoData: false,
      setBankConnected: (v) => set({ isBankConnected: v }),
      setJustConnected: (v) => set({ justConnected: v }),
      setHasLoadedDemoData: (v) => set({ hasLoadedDemoData: v }),
      syncFromStorage: () => {
        const hasToken =
          !!localStorage.getItem('tink_access_token') ||
          !!sessionStorage.getItem('tink_access_token');
        set({ isBankConnected: hasToken });
      },
    }),
    {
      name: 'aura-bank-state',
      partialize: (s) => ({ isBankConnected: s.isBankConnected, hasLoadedDemoData: s.hasLoadedDemoData }),
    }
  )
);
