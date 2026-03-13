import { useCallback, useState } from 'react';
import { classifyTransaction as apiClassifyTransaction, ClassificationResult } from '../api/client';

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

/**
 * AI 분류 API와 통신하는 커스텀 훅
 * 거래 데이터를 백엔드로 전송하고 분류 결과를 받아옴
 */
export function useTransactionClassifier() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 단일 거래 분류
   */
  const classifyTransaction = useCallback(async (
    description: string,
    amount: number = 0,
    currency: string = 'USD'
  ) => {
    setLoading(true);
    setError(null);

    try {
      // 새로운 API 클라이언트 사용
      const result = await apiClassifyTransaction(description, amount, currency);

      // 새 거래를 상태에 추가
      const newTransaction: Transaction = {
        id: `${Date.now()}_${Math.random()}`,
        description,
        amount,
        currency,
        type: 'expense',
        classification: result,
        timestamp: Date.now(),
        district: result.district,
        color: result.color,
      };

      setTransactions(prev => {
        // 최근 100개만 유지 (메모리 관리)
        const updated = [...prev, newTransaction];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });

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
   * 여러 거래 일괄 분류
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
      // 새로운 API 클라이언트 사용
      const { classifyBatch: apiBatchClassify } = await import('../api/client');
      const results = await apiBatchClassify(transactions);

      // 모든 결과를 상태에 추가
      const newTransactions: Transaction[] = results.map((result, index) => ({
        id: `${Date.now()}_${index}`,
        description: transactions[index].description,
        amount: transactions[index].amount || 0,
        currency: transactions[index].currency || 'USD',
        type: 'expense' as TransactionType,
        classification: result,
        timestamp: Date.now() + index * 100,
        district: result.district,
        color: result.color,
      }));

      setTransactions(prev => {
        // 최근 100개만 유지 (메모리 관리)
        const updated = [...prev, ...newTransactions];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });

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
   */
  const addPreClassifiedTransaction = useCallback((
    description: string,
    amount: number,
    currency: string,
    type: TransactionType,
    classification: ClassificationResult,
  ) => {
    const newTransaction: Transaction = {
      id: `${Date.now()}_${Math.random()}`,
      description,
      amount,
      currency,
      type,
      classification,
      timestamp: Date.now(),
      district: classification.district,
      color: classification.color,
    };
    setTransactions(prev => {
      const updated = [...prev, newTransaction];
      return updated.length > 100 ? updated.slice(-100) : updated;
    });
  }, []);

  /**
   * 모든 거래 삭제
   */
  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  /**
   * 은행 거래 배치 적용 (캐시 hydration / revalidate)
   * API 응답 형식(DbTransaction)을 Transaction으로 변환하여 일괄 설정
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
      return {
        id: tx.id ?? `bank_${Date.now()}_${i}`,
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency ?? 'USD',
        type: (tx.type as TransactionType) ?? 'expense',
        classification: {
          district: tx.district,
          confidence: tx.confidence ?? 0,
          reason: tx.reason ?? '',
          icon: tx.icon ?? 'circle',
          color: tx.color ?? '#6b7280',
        },
        timestamp: ts,
        district: tx.district,
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
