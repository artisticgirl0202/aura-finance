/**
 * Aura Finance — 은행 거래 캐시 Store (Zustand Persist + Stale-while-revalidate)
 * ─────────────────────────────────────────────────────────────────
 * 새로고침 시 캐시 즉시 표시 → 백그라운드에서 DB 재검증
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** API 응답 형식 (GET /transactions의 data 항목) */
export interface CachedBankTx {
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
}

interface TransactionState {
  bankTransactions: CachedBankTx[];
  setBankTransactions: (txs: CachedBankTx[]) => void;
  clearBankTransactions: () => void;
  /** 캐시에서 즉시 반환 (hydration용) */
  getCached: () => CachedBankTx[];
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      bankTransactions: [],
      setBankTransactions: (txs) => set({ bankTransactions: txs }),
      clearBankTransactions: () => set({ bankTransactions: [] }),
      getCached: () => get().bankTransactions,
    }),
    { name: 'aura-bank-transactions' }
  )
);
