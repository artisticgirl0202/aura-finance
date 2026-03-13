/**
 * useAnalyticsInsights — Phase 3 AI Smart Alerts
 *
 * Fetches /api/v1/analytics/insights and provides:
 * - insights: array of AI-generated warnings/praise
 * - dismissedIds: set of dismissed insight ids (persists during session)
 * - dismiss: mark an insight as dismissed
 * - refresh: manual refetch
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAnalyticsInsights, type AnalyticsInsight } from '../api/client';

const POLL_MS = 45_000; // 45초마다 폴링

export function useAnalyticsInsights(enabled: boolean) {
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetchAnalyticsInsights({ limit: 500 });
      const fresh = res.insights ?? [];
      // Filter out already-dismissed
      const filtered = fresh.filter((i) => !dismissedRef.current.has(i.id));
      setInsights(filtered);
    } catch (e) {
      console.warn('Analytics insights fetch failed:', e);
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

  const dismiss = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { insights, loading, dismiss, refresh: load };
}
