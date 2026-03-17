import { useCallback, useState } from 'react';
import { classifyTransaction as apiClassifyTransaction, ClassificationResult } from '../api/client';
import { normalizeDistrictFor3D } from '../utils/districtMap';

export type TransactionType = 'expense' | 'income' | 'investment';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  type: TransactionType;
  classification: ClassificationResult;
  timestamp: number;
  // backward-compat shortcuts
  district: string;
  color: string;
}

const MAX_TRANSACTIONS = 100;

/** API 응답의 district → 3D 맵 호환 문자열 (API 응답만 사용, selectedDistrict 등 UI 상태 금지) */
function resolveDistrictFromApi(classification: ClassificationResult): string {
  return normalizeDistrictFor3D(classification.district);
}

/** 불변 업데이트: 새 트랜잭션 추가 (맨 앞), 최대 개수 제한 — 3D/대시보드에 즉시 반영 */
function prependTransactions(prev: Transaction[], newItems: Transaction[]): Transaction[] {
  const updated = [...newItems, ...prev];
  return updated.length > MAX_TRANSACTIONS ? updated.slice(0, MAX_TRANSACTIONS) : updated;
}

/** 불변 업데이트: 뒤에 추가 (batch용) */
function appendTransactions(prev: Transaction[], newItems: Transaction[]): Transaction[] {
  const updated = [...prev, ...newItems];
  return updated.length > MAX_TRANSACTIONS ? updated.slice(-MAX_TRANSACTIONS) : updated;
}

/**
 * AI 분류 API와 통신하는 커스텀 훅
 * 거래 데이터를 백엔드로 전송하고 분류 결과를 받아옴
 * ⚠️ 트랜잭션 district는 반드시 API 응답(classification.district)만 사용 — selectedDistrict 미사용
 */
export function useTransactionClassifier() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 단일 거래 분류 — API 응답 district만 사용 (selectedDistrict 사용 금지)
   */
  const classifyTransaction = useCallback(async (
    description: string,
    amount: number = 0,
    currency: string = 'USD'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClassifyTransaction(description, amount, currency);

      // ⚠️ district는 API 응답(result.district)만 사용 — 3D 맵/파티클 정확 타겟
      const apiDistrict = resolveDistrictFromApi(result);

      const newTransaction: Transaction = {
        id: `${Date.now()}_${Math.random()}`,
        description,
        amount,
        currency,
        type: 'expense',
        classification: result,
        timestamp: Date.now(),
        district: apiDistrict,
        color: result.color,
      };

      setTransactions(prev => prependTransactions(prev, [newTransaction]));

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Unknown error occurred';

      setError(errorMessage);
      console.error('❌ Classification error:', err);
      return null;

    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 여러 거래 일괄 분류 — 각 항목 district는 API 응답만 사용
   */
  const classifyBatch = useCallback(async (
    transactions: Array<{
      description: string;
      amount?: number;
      currency?: string;
    }>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { classifyBatch: apiBatchClassify } = await import('../api/client');
      const results = await apiBatchClassify(transactions);

      const newTransactions: Transaction[] = results.map((result, index) => {
        const apiDistrict = resolveDistrictFromApi(result);
        return {
          id: `${Date.now()}_${index}`,
          description: transactions[index].description,
          amount: transactions[index].amount || 0,
          currency: transactions[index].currency || 'USD',
          type: 'expense' as TransactionType,
          classification: result,
          timestamp: Date.now() + index * 100,
          district: apiDistrict,
          color: result.color,
        };
      });

      setTransactions(prev => appendTransactions(prev, newTransactions));

      return results;

    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Unknown error occurred';

      setError(errorMessage);
      console.error('❌ Batch classification error:', err);
      return null;

    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Pre-classified transaction (e.g. from WebSocket) — skips API call.
   * district는 classification.district(API/WS 응답)만 사용.
   */
  const addPreClassifiedTransaction = useCallback((
    description: string,
    amount: number,
    currency: string,
    type: TransactionType,
    classification: ClassificationResult,
  ) => {
    const apiDistrict = resolveDistrictFromApi(classification);
    const newTransaction: Transaction = {
      id: `${Date.now()}_${Math.random()}`,
      description,
      amount,
      currency,
      type,
      classification,
      timestamp: Date.now(),
      district: apiDistrict,
      color: classification.color,
    };
    setTransactions(prev => prependTransactions(prev, [newTransaction]));
  }, []);

  /**
   * 모든 거래 삭제
   */
  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  /**
   * 은행 거래 배치 적용 (캐시 hydration / revalidate)
   * DB 응답의 district만 사용 — 3D 맵 호환 정규화
   */
  const setBankTransactionsBatch = useCallback((
    txs: Array<{
      id?: string;
      description: string;
      amount: number;
      currency?: string;
      type?: string;
      district: string;
      confidence?: number;
      reason?: string | null;
      icon?: string | null;
      color?: string | null;
      tx_timestamp?: string | null;
    }>
  ) => {
    const mapped: Transaction[] = txs.map((tx, i) => {
      const ts = tx.tx_timestamp ? new Date(tx.tx_timestamp).getTime() : Date.now() - txs.length + i;
      const apiDistrict = normalizeDistrictFor3D(tx.district);
      return {
        id: tx.id ?? `bank_${Date.now()}_${i}`,
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency ?? 'USD',
        type: (tx.type as TransactionType) ?? 'expense',
        classification: {
          district: apiDistrict,
          confidence: tx.confidence ?? 0,
          reason: tx.reason ?? '',
          icon: tx.icon ?? 'circle',
          color: tx.color ?? '#6b7280',
        },
        timestamp: ts,
        district: apiDistrict,
        color: tx.color ?? '#6b7280',
      };
    });
    setTransactions(mapped);
  }, []);

  return {
    transactions,
    loading,
    error,
    classifyTransaction,
    classifyBatch,
    addPreClassifiedTransaction,
    clearTransactions,
    setBankTransactionsBatch,
  };
}
