/**
 * 🎬 실시간 시뮬레이션 모드 Hook (무한 루프 방지 버전)
 *
 * 백엔드 WebSocket에 연결하여 실시간으로 랜덤 거래를 받아옵니다.
 * - 중복 연결 방지
 * - 자동 재연결 (5초 간격)
 * - 안전한 cleanup
 */

import { useEffect, useRef, useState } from 'react';

export interface SimulationTransaction {
  description: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income' | 'investment';
  classification: {
    district: string;
    confidence: number;
    reason: string;
    icon: string;
    color: string;
  };
  timestamp: number;
}

interface UseSimulationModeProps {
  onTransaction?: (transaction: SimulationTransaction) => void;
  enabled?: boolean;
}

export function useSimulationMode({ onTransaction, enabled = false }: UseSimulationModeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<SimulationTransaction | null>(null);

  // WebSocket 인스턴스
  const wsRef = useRef<WebSocket | null>(null);
  // 재연결 타이머
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 연결 진행 중 플래그
  const isConnectingRef = useRef(false);
  // onTransaction 최신 참조
  const onTransactionRef = useRef(onTransaction);
  // enabled 최신 참조 (클로저 문제 해결)
  const enabledRef = useRef(enabled);

  // onTransaction 업데이트
  useEffect(() => {
    onTransactionRef.current = onTransaction;
  }, [onTransaction]);

  // enabled 최신 값 업데이트
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    // enabled가 false면 모든 연결 정리
    if (!enabled) {
      console.log('[Cleanup] Simulation disabled by user');

      if (wsRef.current) {
        // 정상 종료 코드로 닫기 (1000 = Normal Closure)
        wsRef.current.close(1000, 'User stopped simulation');
        wsRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
      setError(null);
      isConnectingRef.current = false;
      return;
    }

    // 중복 연결 방지: 이미 연결되어 있거나 연결 중이면 스킵
    if (isConnectingRef.current) {
      console.log('[Skip] Connection already in progress');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[Skip] Already connected');
      return;
    }

    // WebSocket 연결 함수
    const connect = () => {
      if (isConnectingRef.current) {
        return;
      }

      isConnectingRef.current = true;

      const WS_URL = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8000';
      const wsUrl = `${WS_URL}/ws/simulation`;

      console.log('[Connecting] to:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[Connected] Simulation started');
          setIsConnected(true);
          setError(null);
          isConnectingRef.current = false;
        };

        ws.onmessage = (event) => {
          try {
            const transaction: SimulationTransaction = JSON.parse(event.data);
            console.log('[Received]', transaction.description, '→', transaction.classification.district);

            setLastTransaction(transaction);

            // 최신 콜백 참조 사용 (무한 루프 방지)
            if (onTransactionRef.current) {
              onTransactionRef.current(transaction);
            }
          } catch (err) {
            console.error('[Parse Error]', err);
          }
        };

        ws.onerror = (event) => {
          console.error('[WebSocket Error]', event);
          setError('Connection error');
          isConnectingRef.current = false;
        };

        ws.onclose = (event) => {
          console.log('[Closed]', event.code, event.reason);
          setIsConnected(false);
          wsRef.current = null;
          isConnectingRef.current = false;

          // enabled 상태일 때만 재연결 시도 (최신 ref 값 사용)
          if (enabledRef.current && !reconnectTimeoutRef.current) {
            console.log('[Reconnecting] in 5 seconds...');
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              // 다시 한번 확인 (타이머 실행 시점에 enabled가 false면 재연결 안 함)
              if (enabledRef.current) {
                connect();
              }
            }, 5000);
          } else {
            console.log('[No Reconnect] Simulation disabled');
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[Connection Failed]', err);
        setError('Failed to connect');
        isConnectingRef.current = false;
      }
    };

    // 초기 연결 시작
    connect();

    // Cleanup: 컴포넌트 언마운트 또는 enabled 변경 시
    return () => {
      console.log('[Cleanup] Unmounting or enabled changed');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup');
        wsRef.current = null;
      }

      isConnectingRef.current = false;
      setIsConnected(false);
    };
  }, [enabled]); // onTransaction은 의존성에서 제거 (무한 루프 방지)

  return {
    isConnected,
    error,
    lastTransaction,
  };
}
