/**
 * useAnalyticsOverview — Budget vs actual, M4 trend risk, M6 AI advice
 *
 * Fetches /analytics/overview and provides:
 * - categoryOverview: per-district spend, limit, exceed probability, risk level
 * - aiAdvice: actionable advice cards for AI Advisor panel
 * - districtRiskRatios: synthetic ratio for 3D viz (trend risk forces red when exceed_prob high)
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchAnalyticsOverview } from '../api/client';

export interface CategoryOverview {
  district: string;
  spent: number;
  limit: number;
  utilization_pct: number;
  trend_direction: string;
  exceed_probability: number;
  risk_level: string;
  trend_explanation: string;
}

export interface SpendingDistributionItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

export interface MonthOverMonth {
  this_month_expense: number;
  last_month_expense: number;
  change_pct: number;
  change_direction: string;
  this_month_income: number;
  last_month_income: number;
}

export interface Volatility {
  std_dev: number;
  mean: number;
  coefficient_of_variation: number;
  volatility_level: string;
  months_analyzed: number;
}

export interface MonthlyTrendItem {
  month: string;
  month_label: string;
  income: number;
  expense: number;
  balance: number;
}

export interface AnalyticsOverview {
  categories: CategoryOverview[];
  ai_advice: Array<{
    id?: string;
    title?: string;
    body?: string;
    action_items?: string[];
    estimated_impact?: string;
    supporting_data?: Record<string, unknown>;
    priority?: string;
  }>;
  risk_score: number;
  income_total: number;
  expense_total: number;
  updated_at: string;
  // Phase 2: Chart-ready stats
  spending_distribution?: SpendingDistributionItem[];
  month_over_month?: MonthOverMonth;
  volatility?: Volatility;
  monthly_trend?: MonthlyTrendItem[];
  portfolio_score?: number | null;
  savings_rate?: number | null;
}

const POLL_MS = 60_000;

export function useAnalyticsOverview(enabled: boolean) {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetchAnalyticsOverview({ limit: 500 });
      setData(res);
    } catch (e) {
      console.warn('Analytics overview fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
    if (!enabled) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load, enabled]);

  // districtRiskRatios: when exceed_prob >= 0.8 or risk high/critical, use min 0.8 for 3D red tint
  const districtRiskRatios = data
    ? Object.fromEntries(
        data.categories
          .filter(
            (c) =>
              c.exceed_probability >= 0.8 ||
              c.risk_level === 'high' ||
              c.risk_level === 'critical'
          )
          .map((c) => [
            c.district,
            Math.max(c.utilization_pct / 100, c.exceed_probability, 0.8),
          ])
      )
    : {};

  return {
    overview: data,
    loading,
    districtRiskRatios,
    refresh: load,
  };
}
