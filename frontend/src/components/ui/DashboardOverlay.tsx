/**
 * 🎯 통일된 실시간 금융 대시보드
 * STATS 기반 그리드 레이아웃 - EXPENSE, INCOME, INVEST, STATS 탭 동일 구조
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CreditCard, PieChart as PieIcon, Search, TrendingUp, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOverview, MonthlyTrendItem } from '../../hooks/useAnalyticsOverview';
import { getDistrictColor } from '../../constants/districtColors';
import { formatTransactionDate } from '../../utils/dateFormat';
import { StatsDashboard } from './StatsDashboard';
import { DashboardWidget } from './DashboardWidget';

interface Transaction {
  description: string;
  amount: number;
  currency: string;
  type?: 'expense' | 'income' | 'investment';
  classification: {
    district: string;
    confidence: number;
    reason: string;
    icon: string;
    color: string;
  };
  timestamp: number;
  id: string;
}

type ActiveTab = 'expense' | 'income' | 'investment' | 'stats';

interface DashboardOverlayProps {
  transactions: Transaction[];
  budgetRatios?: Record<string, number>;
  budgetSettings?: { total: number; categories: Record<string, number> };
  categorySpend?: Record<string, number>;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  analyticsOverview?: AnalyticsOverview | null;
  analyticsLoading?: boolean;
}

const CHART_COLORS = {
  primary: '#06b6d4',
  secondary: '#8b5cf6',
  income: '#10b981',
  expense: '#ef4444',
  invest: '#3b82f6',
  grid: 'rgba(255,255,255,0.06)',
};

function aggregateByCategory(transactions: Transaction[]) {
  const categoryMap = new Map<string, { amount: number; color: string; count: number }>();
  transactions.forEach((tx) => {
    if (!tx) return;
    const category = (tx.classification?.district ?? (tx as { district?: string }).district ?? 'Unknown').trim();
    const color = getDistrictColor(tx.classification?.district ?? (tx as { district?: string }).district);
    const amount = Math.abs(tx.amount ?? 0);
    const existing = categoryMap.get(category) || { amount: 0, color, count: 0 };
    categoryMap.set(category, {
      amount: existing.amount + amount,
      color,
      count: existing.count + 1,
    });
  });
  return Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    value: data.amount,
    count: data.count,
    color: data.color,
  }));
}

function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return count;
}

/** 월별 트렌드 계산 (트랜잭션 기준) */
function useMonthlyTrend(
  transactions: Transaction[],
  overviewTrend: MonthlyTrendItem[] | undefined,
  activeTab: ActiveTab
) {
  return useMemo(() => {
    if (overviewTrend?.length && activeTab !== 'investment') {
      return overviewTrend.map((m) => ({
        month_label: m.month_label,
        value: activeTab === 'income' ? m.income : m.expense,
      }));
    }
    const byMonth = new Map<string, number>();
    transactions.forEach((tx) => {
      const d = new Date(tx.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + tx.amount);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([k, v]) => ({
        month_label: k,
        value: v,
      }));
  }, [transactions, overviewTrend, activeTab]);
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const color = data.color || '#6b7280';
  return (
    <div style={{
      background: 'rgba(8,14,30,0.95)',
      border: `1px solid ${color}60`,
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: `0 0 20px ${color}30`,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{data.name}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 4 }}>
        ${(data.value ?? 0).toLocaleString()}
      </div>
    </div>
  );
};

const TrendTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'rgba(8,14,30,0.95)',
      border: '1px solid rgba(6,182,212,0.4)',
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: '0 0 20px rgba(6,182,212,0.2)',
    }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{d.month_label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: CHART_COLORS.primary }}>
        ${(d.value ?? 0).toFixed(0)}
      </div>
    </div>
  );
};

const TAB_META: Record<string, { label: string; color: string; title: string }> = {
  expense: { label: 'EXPENSE', color: '#ef4444', title: 'Total Spend' },
  income: { label: 'INCOME', color: '#10b981', title: 'Total Income' },
  investment: { label: 'INVEST', color: '#3b82f6', title: 'Portfolio Value' },
  stats: { label: 'STATS', color: '#06b6d4', title: 'Analytics & Insights' },
};

const TABS: ActiveTab[] = ['expense', 'income', 'investment', 'stats'];

const TAB_LABELS: Record<ActiveTab, { chart: string; list: string; trend: string }> = {
  expense: {
    chart: 'Expense Breakdown',
    list: 'Recent Expenses',
    trend: 'Monthly Expense Trend',
  },
  income: {
    chart: 'Income Sources',
    list: 'Recent Income',
    trend: 'Monthly Income Trend',
  },
  investment: {
    chart: 'Portfolio Allocation',
    list: 'Asset List',
    trend: 'Monthly Trend',
  },
  stats: {
    chart: 'Analytics',
    list: 'Overview',
    trend: 'Trend',
  },
};

export function DashboardOverlay({
  transactions,
  budgetSettings,
  categorySpend,
  activeTab = 'expense',
  onTabChange,
  searchQuery = '',
  onClearSearch,
  analyticsOverview = null,
  analyticsLoading = false,
}: DashboardOverlayProps) {
  const expenseTxs = transactions.filter((t) => {
    const type = (t as { type?: string }).type;
    if (type === 'income' || type === 'investment') return false;
    return true;
  });
  const incomeTxs = transactions.filter((t) => (t as any).type === 'income');
  const investmentTxs = transactions.filter((t) => (t as any).type === 'investment');

  const viewTxs = activeTab === 'income' ? incomeTxs : activeTab === 'investment' ? investmentTxs : expenseTxs;
  const meta = TAB_META[activeTab] ?? TAB_META['expense'];
  const labels = TAB_LABELS[activeTab] ?? TAB_LABELS['expense'];

  const totalAmount = viewTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const animatedTotal = useCountUp(totalAmount, 800);
  const chartData = aggregateByCategory(viewTxs);
  const recentTransactions = [...viewTxs]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 5);

  const trendData = useMonthlyTrend(viewTxs, analyticsOverview?.monthly_trend, activeTab);

  const q = searchQuery.trim().toLowerCase();
  const searchMatches = q
    ? transactions
        .filter((t) => {
          const desc = (t.description ?? '').toLowerCase();
          const district = (t.classification?.district ?? '').toLowerCase();
          const reason = (t.classification?.reason ?? '').toLowerCase();
          return desc.includes(q) || district.includes(q) || reason.includes(q);
        })
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    : [];

  /** 탭 버튼 행 — 모든 뷰 상단에 표시 */
  const TabRow = () => (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '0 0 16px 0',
        marginBottom: 8,
        borderBottom: '1px solid rgba(6,182,212,0.12)',
        flexShrink: 0,
      }}
    >
      {TABS.map((tabId) => {
        const meta = TAB_META[tabId];
        const isActive = activeTab === tabId;
        return (
          <button
            key={tabId}
            type="button"
            onClick={() => onTabChange?.(tabId)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              border: 'none',
              borderBottom: isActive ? `2px solid ${meta.color}` : '2px solid transparent',
              background: isActive ? `${meta.color}18` : 'transparent',
              color: isActive ? meta.color : '#64748b',
              fontSize: 11,
              fontFamily: 'var(--font-display)',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              textShadow: isActive ? `0 0 8px ${meta.color}80` : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(6,182,212,0.08)';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }
            }}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );

  // ── STATS tab ──
  if (activeTab === 'stats') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="cyberpunk-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 16,
          paddingRight: 16,
          paddingBottom: 80,
          paddingLeft: 16,
          marginRight: 8,
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <TabRow />
        <StatsDashboard overview={analyticsOverview ?? null} loading={analyticsLoading} />
      </motion.div>
    );
  }

  // ── Search mode ──
  if (q) {
    return (
      <motion.div
        key={`search-${q}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="cyberpunk-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 20,
          paddingRight: 20,
          paddingBottom: 20,
          paddingLeft: 20,
          marginRight: 8,
        }}
      >
        <TabRow />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 13, color: '#f59e0b', letterSpacing: 2, fontWeight: 700 }}>
              <Search size={16} strokeWidth={2} /> SEARCH RESULTS
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>"{searchQuery}" — {searchMatches.length} match{searchMatches.length !== 1 ? 'es' : ''}</div>
          </div>
          <button
            onClick={onClearSearch}
            style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 8, color: '#f59e0b', fontSize: 11, cursor: 'pointer',
              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <X size={14} strokeWidth={2} /> CLEAR
          </button>
        </div>
        {searchMatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569', fontSize: 13 }}>
            No transactions match "{searchQuery}"
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {searchMatches.map((tx, i) => {
              const typeColor = (tx as any).type === 'income' ? '#10b981' : (tx as any).type === 'investment' ? '#6366f1' : '#f43f5e';
              return (
                <motion.div
                  key={tx.id ?? i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    background: 'rgba(15,20,45,0.9)',
                    border: `1px solid ${getDistrictColor(tx.classification?.district ?? (tx as any).district)}35`,
                    borderLeft: `3px solid ${getDistrictColor(tx.classification?.district ?? (tx as any).district)}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description}
                    </div>
                    <span style={{ color: typeColor, fontSize: 14, fontWeight: 700, marginLeft: 10 }}>
                      {(tx as any).type === 'expense' || !(tx as any).type ? '-' : '+'}${tx.amount.toFixed(0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: getDistrictColor(tx.classification?.district ?? (tx as any).district), marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{tx.classification?.district ?? 'Unknown'}</span>
                    <span style={{ color: '#475569' }}>{formatTransactionDate(tx.timestamp)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // ── Unified grid layout: EXPENSE / INCOME / INVEST ──
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="cyberpunk-scrollbar"
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 48,
        paddingLeft: 16,
        marginRight: 8,
        boxSizing: 'border-box',
      }}
    >
      <TabRow />
      {/* Header: Tab badge + Total */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 20,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}50`,
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            color: meta.color,
            letterSpacing: 1.5,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
          {meta.label} VIEW
        </div>
        <div style={{ fontSize: 12, color: CHART_COLORS.primary, letterSpacing: 2, fontFamily: 'var(--font-display)', marginBottom: 4 }}>{meta.title}</div>
        <motion.div key={animatedTotal} initial={{ scale: 1.1 }} animate={{ scale: 1 }} style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', textShadow: `0 0 20px ${meta.color}` }}>
          ${animatedTotal.toLocaleString()}
        </motion.div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{viewTxs.length} transactions</div>
      </div>

      {/* 1-column layout: all widgets full width, gap-6 */}
      <div
        className="dashboard-widget-gap"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minWidth: 0,
        }}
      >
        {/* Donut Chart — full width, scaled to container */}
        <DashboardWidget title={labels.chart} icon={<PieIcon size={12} strokeWidth={2} />} accentColor={`${meta.color}80`}>
          {chartData.length > 0 ? (
            <div className="dashboard-chart-container" style={{ width: '100%', overflow: 'visible' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    animationDuration={800}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    layout="vertical"
                    verticalAlign="bottom"
                    align="center"
                    formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 15 }}>{v}</span>}
                    wrapperStyle={{ fontSize: 16 }}
                    iconSize={14}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, color: '#64748b', fontSize: 12 }}>
              <PieIcon size={32} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
              No data yet
            </div>
          )}
        </DashboardWidget>

        {/* Recent List — full width, justify-between, expanded padding */}
        <DashboardWidget title={labels.list} icon={<CreditCard size={12} strokeWidth={2} />} accentColor={`${meta.color}80`}>
        <div
          className="cyberpunk-scrollbar dashboard-list-gap"
          style={{ width: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 380 }}
        >
            {recentTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14, padding: 32 }}>No transactions yet</div>
            ) : (
              recentTransactions.map((tx, i) => {
                if (!tx) return null;
                const color = getDistrictColor(tx.classification?.district ?? (tx as any).district);
                const type = (tx as any).type as string | undefined;
                const amountColor = type === 'income' ? '#10b981' : type === 'investment' ? '#6366f1' : '#ef4444';
                const amountSign = type === 'income' || type === 'investment' ? '+' : '-';
                return (
                  <motion.div
                    key={tx.id ?? i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="dashboard-list-item"
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: `0.5px solid ${color}30`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: 16 }}>
                      <div className="dashboard-list-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'Unknown'}</div>
                      <div className="dashboard-list-secondary" style={{ color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{tx.classification?.district ?? 'Unknown'}</span>
                        <span style={{ color: '#475569', fontSize: 11 }}>{formatTransactionDate(tx.timestamp)}</span>
                      </div>
                    </div>
                    <span className="dashboard-list-amount" style={{ color: amountColor, fontWeight: 700 }}>
                      {amountSign}${Math.abs(tx.amount).toFixed(0)}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        </DashboardWidget>

        {/* Monthly Trend */}
        <DashboardWidget title={labels.trend} icon={<TrendingUp size={12} strokeWidth={2} />} accentColor="rgba(6,182,212,0.5)">
        {trendData.length > 0 ? (
          <div className="dashboard-chart-container" style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id={`trendGrad-${activeTab}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month_label" tick={{ fontSize: 15, fill: '#64748b' }} stroke={CHART_COLORS.grid} />
                <YAxis tick={{ fontSize: 15, fill: '#64748b' }} stroke={CHART_COLORS.grid} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<TrendTooltip />} />
                <Area type="monotone" dataKey="value" stroke={meta.color} fill={`url(#trendGrad-${activeTab})`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 160, color: '#64748b', fontSize: 12 }}>
            <TrendingUp size={32} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
            No trend data yet
          </div>
        )}
      </DashboardWidget>

        {/* Budget Status — Expense only */}
        {activeTab === 'expense' && budgetSettings && categorySpend && Object.keys(budgetSettings.categories).some((k) => budgetSettings.categories[k] > 0) && (
          <DashboardWidget title="BUDGET STATUS" accentColor="rgba(139,92,246,0.5)">
          <div className="dashboard-list-gap" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {Object.entries(budgetSettings.categories)
              .filter(([, limit]) => limit > 0)
              .map(([district, limit]) => {
                const spent = categorySpend[district] || 0;
                const ratio = spent / limit;
                const barColor = ratio >= 1 ? '#ef4444' : ratio >= 0.8 ? '#f59e0b' : '#06b6d4';
                return (
                  <div key={district} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="dashboard-list-secondary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>{district}</span>
                      <span style={{ color: barColor }}>${spent.toFixed(0)} / ${limit.toFixed(0)}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(ratio * 100, 100)}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </DashboardWidget>
        )}
      </div>
    </motion.div>
  );
}
