/**
 * Aura Finance — Phase 2 Stats Dashboard (Recharts)
 * 통일된 그리드 레이아웃 + DashboardWidget 카드 시스템
 */

import { motion } from 'framer-motion';
import { BarChart2, Loader2 } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnalyticsOverview,
  MonthOverMonth,
  MonthlyTrendItem,
  SpendingDistributionItem,
  Volatility,
} from '../../hooks/useAnalyticsOverview';
import { DashboardWidget } from './DashboardWidget';

const CHART_COLORS = {
  primary: '#06b6d4',
  secondary: '#8b5cf6',
  income: '#10b981',
  expense: '#ef4444',
  grid: 'rgba(255,255,255,0.06)',
  tooltipBg: 'rgba(8,14,30,0.95)',
};

// ── Custom Tooltip (dark glassmorphism + neon) ────────────────────────────────
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload as SpendingDistributionItem;
  return (
    <div style={{
      background: CHART_COLORS.tooltipBg,
      border: `1px solid ${p.color}60`,
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: `0 0 20px ${p.color}30`,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{p.name}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: p.color, marginTop: 4 }}>
        ${p.value.toLocaleString()} ({p.percent.toFixed(1)}%)
      </div>
    </div>
  );
};

const AreaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as MonthlyTrendItem;
  return (
    <div style={{
      background: CHART_COLORS.tooltipBg,
      border: '1px solid rgba(6,182,212,0.4)',
      borderRadius: 10,
      padding: '12px 16px',
      boxShadow: '0 0 20px rgba(6,182,212,0.2)',
    }}>
      <div style={{ fontSize: 13, color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>{d.month_label}</div>
      <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
        <span style={{ color: CHART_COLORS.income }}>Income: ${d.income.toFixed(0)}</span>
        <span style={{ color: CHART_COLORS.expense }}>Expense: ${d.expense.toFixed(0)}</span>
      </div>
      <div style={{ fontSize: 14, color: CHART_COLORS.primary, marginTop: 4 }}>
        Balance: ${d.balance.toFixed(0)}
      </div>
    </div>
  );
};

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: `0 0 24px ${color}40`, borderColor: `${color}60` }}
      className="dashboard-widget-padding"
      style={{
        width: '100%',
        minWidth: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '0.5px solid rgba(6, 182, 212, 0.3)',
        borderRadius: 14,
      }}
    >
      <div className="dashboard-kpi-label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="dashboard-kpi-value" style={{ color, textShadow: `0 0 12px ${color}80` }}>{value}</div>
      {sub && <div className="dashboard-kpi-sub" style={{ marginTop: 4 }}>{sub}</div>}
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface StatsDashboardProps {
  overview: AnalyticsOverview | null;
  loading: boolean;
}

export function StatsDashboard({ overview, loading }: StatsDashboardProps) {
  const dist = overview?.spending_distribution ?? [];
  const mom = overview?.month_over_month ?? ({} as MonthOverMonth);
  const vol = overview?.volatility ?? {} as Volatility;
  const trend = overview?.monthly_trend ?? [];
  const portfolioScore = overview?.portfolio_score ?? null;
  const savingsRate = overview?.savings_rate ?? null;

  const hasData = dist.length > 0 || trend.length > 0 || portfolioScore !== null;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#64748b' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ marginBottom: 12 }}>
          <Loader2 size={32} strokeWidth={2} color="#64748b" />
        </motion.div>
        <div style={{ fontSize: 12, letterSpacing: 2 }}>Loading stats...</div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}
      >
        <BarChart2 size={48} strokeWidth={1.5} color="#64748b" style={{ marginBottom: 16, opacity: 0.6 }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No data yet</div>
        <div style={{ fontSize: 12 }}>Add transactions to see spending distribution, trends, and AI scores.</div>
      </motion.div>
    );
  }

  const momDir = mom.change_direction === 'rising' ? '↑' : mom.change_direction === 'falling' ? '↓' : '→';
  const momColor = mom.change_direction === 'rising' ? '#ef4444' : mom.change_direction === 'falling' ? '#10b981' : '#64748b';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="cyberpunk-scrollbar"
      style={{
        width: '100%',
        overflowY: 'visible',
        overflowX: 'hidden',
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 60,
        paddingLeft: 16,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: CHART_COLORS.primary, letterSpacing: 3, marginBottom: 6 }}>
          STATISTICS DASHBOARD
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>Financial Overview</div>
      </div>

      {/* KPI Row — full width grid */}
      <div
        className="dashboard-grid-gap"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          marginBottom: 24,
          width: '100%',
        }}
      >
        <KPICard
          label="MoM Change"
          value={`${momDir} ${mom.change_pct?.toFixed(1) ?? 0}%`}
          sub={mom.this_month_expense != null ? `This: $${mom.this_month_expense.toFixed(0)}` : undefined}
          color={momColor}
        />
        <KPICard
          label="Volatility"
          value={vol.volatility_level ?? 'low'}
          sub={vol.coefficient_of_variation != null ? `CV: ${vol.coefficient_of_variation.toFixed(1)}%` : undefined}
          color={vol.volatility_level === 'high' ? '#ef4444' : vol.volatility_level === 'moderate' ? '#f59e0b' : '#10b981'}
        />
        {portfolioScore != null && (
          <KPICard
            label="AI Portfolio"
            value={`${Math.round(portfolioScore)}/100`}
            color={portfolioScore >= 70 ? '#10b981' : portfolioScore >= 50 ? '#f59e0b' : '#ef4444'}
          />
        )}
        {savingsRate != null && (
          <KPICard
            label="Savings Rate"
            value={`${(savingsRate * 100).toFixed(0)}%`}
            color={CHART_COLORS.income}
          />
        )}
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
      {dist.length > 0 && (
        <DashboardWidget title="SPENDING BY CATEGORY" accentColor="rgba(6,182,212,0.5)">
          <div className="dashboard-chart-container" style={{ width: '100%', overflow: 'visible' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                <Pie
                  data={dist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {dist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  layout="vertical"
                  verticalAlign="bottom"
                  align="center"
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 14 }}>{value}</span>}
                  wrapperStyle={{ fontSize: 16 }}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
      )}

      {/* Monthly Trend (Area Chart) */}
      {trend.length > 0 && (
        <DashboardWidget title="MONTHLY INCOME vs EXPENSE" accentColor="rgba(139,92,246,0.5)">
          <div className="dashboard-chart-container" style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.expense} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.expense} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month_label" tick={{ fontSize: 15, fill: '#64748b' }} stroke={CHART_COLORS.grid} />
                <YAxis tick={{ fontSize: 15, fill: '#64748b' }} stroke={CHART_COLORS.grid} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<AreaTooltip />} />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 15 }}>{v}</span>} wrapperStyle={{ fontSize: 16 }} iconSize={14} />
                <Area type="monotone" dataKey="income" stroke={CHART_COLORS.income} fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expense" stroke={CHART_COLORS.expense} fill="url(#expenseGrad)" strokeWidth={2} name="Expense" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
      )}

      {/* Mini Bar: This vs Last Month */}
      {mom.this_month_expense != null && mom.last_month_expense != null && (mom.this_month_expense > 0 || mom.last_month_expense > 0) && (
        <DashboardWidget title="THIS MONTH vs LAST MONTH" accentColor="rgba(245,158,11,0.5)">
          <div className="dashboard-chart-container dashboard-chart-sm" style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { label: 'Last Month', value: mom.last_month_expense, fill: '#475569' },
                  { label: 'This Month', value: mom.this_month_expense, fill: CHART_COLORS.primary },
                ]}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <XAxis type="number" tick={{ fontSize: 15, fill: '#64748b' }} stroke={CHART_COLORS.grid} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 15, fill: '#94a3b8' }} width={100} stroke={CHART_COLORS.grid} />
              <Tooltip
                contentStyle={{ background: CHART_COLORS.tooltipBg, border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8 }}
                formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
                labelFormatter={(l) => l}
              />
                <Bar dataKey="value" radius={4} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
      )}
      </div>
    </motion.div>
  );
}
