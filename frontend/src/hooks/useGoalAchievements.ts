/**
 * useGoalAchievements — Goal Tracker의 달성 목표를 감지하여 3D 축하 이펙트 트리거
 *
 * Budget Settings의 Income/Goals 탭 제거 후, 모든 재무 목표(수입, 투자, 저축, 순자산 등)는
 * Goal Tracker 패널에서만 관리. 이 훅은 백엔드 goals API를 폴링하여 trend='achieved'인
 * 목표를 감지하고 CelebrationEffect에 전달.
 */

import { useCallback, useEffect, useState } from 'react';
import { getGoalsDashboard } from '../api/client';
import type { Goal } from '../api/client';

const POLL_INTERVAL_MS = 60_000; // 1분마다 goals 대시보드 갱신

export function useGoalAchievements(incomeMonthly?: number) {
  const [achievedGoals, setAchievedGoals] = useState<Set<string>>(new Set());
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());

  const fetchAndDetect = useCallback(async () => {
    try {
      const dashboard = await getGoalsDashboard(incomeMonthly);
      const goals = dashboard?.goals ?? [];
      const achieved = goals.filter(
        (g: Goal) => (g.progress?.trend === 'achieved' || (g.progress?.progress_pct ?? 0) >= 100)
      );
      const newIds = new Set(achieved.map((g) => g.id));
      setAchievedGoals(newIds);
    } catch (e) {
      console.warn('Goals dashboard fetch failed:', e);
    }
  }, [incomeMonthly]);

  useEffect(() => {
    fetchAndDetect();
    const id = setInterval(fetchAndDetect, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAndDetect]);

  const clearAchievedGoal = useCallback((key: string) => {
    setCelebratedIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // 축하 표시할 목표 = 달성됐지만 아직 축하 애니메이션 안 한 것
  const toCelebrate = new Set(
    [...achievedGoals].filter((id) => !celebratedIds.has(id))
  );

  return {
    achievedGoals: toCelebrate,
    clearAchievedGoal,
  };
}
