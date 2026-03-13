/**
 * Aura Finance — Goals Dashboard Panel
 * ──────────────────────────────────────────────────────────────────
 * Sliding right panel showing all financial goals with:
 *  - Live progress bars (fetched from /goals/dashboard)
 *  - Trend indicators: ahead / on_track / at_risk / achieved
 *  - M4 AI forecast text
 *  - "Add Goal" inline form
 *  - Per-goal "Simulate" button → opens GoalSimulationModal
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Bot, Loader2, Play, RefreshCw, Target, TrendingUp, Trophy, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Goal,
  GoalCreate,
  GoalDashboard,
  GoalProgress,
  createGoal,
  deleteGoal,
  fetchFinanceOverview,
  fetchGoalForecast,
  getGoalsDashboard,
} from '../../api/client';
import { CountUp } from './CountUp';
import { ErrorBoundary } from './ErrorBoundary';
import { AIInsightCard } from './AIInsightCard';
import { GoalSimulationModal } from './GoalSimulationModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TREND_ICONS = {
  achieved:  Trophy,
  ahead:     TrendingUp,
  on_track:  Target,
  at_risk:   AlertTriangle,
  exceeded:  AlertCircle,
};

const TREND_CONFIG = {
  achieved:  { label: 'Achieved',  color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  ahead:     { label: 'Ahead',     color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  on_track:  { label: 'On Track',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  at_risk:   { label: 'At Risk',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  exceeded:  { label: 'Over Budget', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

const GOAL_TYPE_ICONS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  expense_limit:  Wallet,
  savings:        Wallet,
  income_target:  TrendingUp,
  investment:     TrendingUp,
  net_worth:      Target,
};

const GOAL_TYPE_META: Record<string, { label: string; color: string }> = {
  expense_limit:  { label: 'Expense Limit',  color: '#ef4444' },
  savings:        { label: 'Savings Target', color: '#10b981' },
  income_target:  { label: 'Income Target',  color: '#06b6d4' },
  investment:     { label: 'Investment',     color: '#8b5cf6' },
  net_worth:      { label: 'Net Worth',      color: '#fbbf24' },
};

function fmtCurrency(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

// ── Progress Ring (SVG) ───────────────────────────────────────────────────────

function ProgressRing({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onSimulate,
  onForecast,
  onDelete,
}: {
  goal: Goal;
  onSimulate: (goal: Goal) => void;
  onForecast: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const prog  = goal.progress as GoalProgress | undefined;
  const pct   = prog?.progress_pct ?? (goal as any).cached_progress_pct ?? 0;
  const trend = prog?.trend ?? 'on_track';
  const meta  = TREND_CONFIG[trend as keyof typeof TREND_CONFIG] ?? TREND_CONFIG.on_track;
  const typeMeta = GOAL_TYPE_META[goal.goal_type] ?? { label: goal.goal_type, color: goal.color };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      style={{
        background: 'rgba(15,23,42,0.7)',
        border: `1px solid ${goal.color}30`,
        borderRadius: 14,
        padding: '18px 20px',
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${goal.color}60, transparent)`,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <ProgressRing pct={pct} color={goal.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{goal.name}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, padding: '2px 8px', borderRadius: 99,
              background: meta.bg, color: meta.color, fontWeight: 600, letterSpacing: 1,
            }}>
              {(() => { const Ic = TREND_ICONS[trend as keyof typeof TREND_ICONS]; return Ic ? <Ic size={10} strokeWidth={2} /> : null; })()}
              {meta.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            {(() => { const Ic = GOAL_TYPE_ICONS[goal.goal_type] ?? Target; return <Ic size={12} strokeWidth={2} />; })()}
            {typeMeta.label}
            {prog?.period_label && <span style={{ marginLeft: 8, color: '#475569' }}>· {prog.period_label}</span>}
          </div>
        </div>

        {/* Pct label — CountUp */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 20, fontWeight: 800, color: goal.color,
            textShadow: `0 0 12px ${goal.color}80, 0 0 24px ${goal.color}40`,
          }}>
            <CountUp value={pct} duration={1} decimals={0} suffix="%" />
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>progress</div>
        </div>
      </div>

      {/* Progress bar — neon glow */}
      <div style={{
        height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginBottom: 12, overflow: 'visible',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 99,
            background: `linear-gradient(90deg, ${goal.color}90, ${goal.color})`,
            boxShadow: `0 0 10px ${goal.color}99, 0 0 20px ${goal.color}50, 0 0 4px ${goal.color}`,
            filter: `drop-shadow(0 0 6px ${goal.color})`,
          }}
        />
      </div>

      {/* Amounts row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
        <span style={{ color: '#94a3b8' }}>
          {fmtCurrency(prog?.current_amount ?? 0)}
          <span style={{ color: '#475569' }}> / {fmtCurrency(goal.target_amount)}</span>
        </span>
        {prog?.remaining !== undefined && prog.remaining > 0 && (
          <span style={{ color: '#64748b' }}>{fmtCurrency(prog.remaining)} left</span>
        )}
        {prog?.days_left !== null && prog?.days_left !== undefined && (
          <span style={{ color: '#475569' }}>{prog.days_left}d left</span>
        )}
      </div>

      {/* AI forecast */}
      {prog?.ai_forecast && (
        <div style={{
          background: 'rgba(6,182,212,0.06)', borderLeft: '2px solid #06b6d4',
          borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 12,
          fontSize: 11, color: '#94a3b8', lineHeight: 1.5,
        }}>
          <Bot size={14} strokeWidth={2} style={{ flexShrink: 0, marginRight: 6 }} /> {prog.ai_forecast}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => onSimulate(goal)}
          style={{
            flex: 1, minWidth: 80, padding: '8px 0', borderRadius: 8,
            border: `1px solid ${goal.color}40`,
            background: `${goal.color}12`,
            color: goal.color, fontSize: 11, cursor: 'pointer', fontWeight: 600, letterSpacing: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Play size={12} strokeWidth={2} style={{ flexShrink: 0 }} /> SIMULATE
        </button>
        <button
          onClick={() => onForecast(goal)}
          style={{
            flex: 1, minWidth: 80, padding: '8px 0', borderRadius: 8,
            border: '1px solid rgba(139,92,246,0.4)',
            background: 'rgba(139,92,246,0.12)',
            color: '#a78bfa', fontSize: 11, cursor: 'pointer', fontWeight: 600, letterSpacing: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Bot size={14} strokeWidth={2} /> FORECAST
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          style={{
            padding: '8px 14px', borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.06)',
            color: '#ef4444', fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Add Goal Form ─────────────────────────────────────────────────────────────

const DISTRICTS = [
  'Food & Cafe','Shopping','Housing & Utility','Entertainment',
  'Transport','Healthcare','Education','Finance',
];

/** 영역별 브랜드 색상 (선택 시 자동 적용) */
const AREA_COLOR_MAP: Record<string, string> = {
  'Food & Cafe':      '#f59e0b',
  'Shopping':         '#8b5cf6',
  'Housing & Utility': '#06b6d4',
  'Entertainment':    '#ec4899',
  'Transport':        '#10b981',
  'Healthcare':       '#ef4444',
  'Education':        '#fbbf24',
  'Finance':          '#14b8a6',
};

function AddGoalForm({ onAdd }: { onAdd: (g: GoalCreate) => void }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState('');
  const [type, setType]   = useState<GoalCreate['goal_type']>('expense_limit');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'annual' | 'one_time'>('monthly');
  const [district, setDistrict] = useState('');
  const [color, setColor] = useState('#06b6d4');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const COLORS = ['#06b6d4','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#fbbf24'];

  const handleDistrictChange = (value: string) => {
    setDistrict(value);
    if (value && AREA_COLOR_MAP[value]) {
      setColor(AREA_COLOR_MAP[value]);
    }
  };

  const submit = () => {
    if (!name || !amount) return;
    onAdd({
      name, goal_type: type, target_amount: parseFloat(amount),
      period_type: period, district: district || undefined, color,
      icon: 'target',
    });
    setName(''); setAmount(''); setOpen(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <motion.button
        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 10,
          border: '1px dashed rgba(6,182,212,0.4)',
          background: open ? 'rgba(6,182,212,0.08)' : 'transparent',
          color: '#06b6d4', fontSize: 12, cursor: 'pointer', letterSpacing: 2,
          fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {open ? <><X size={14} strokeWidth={2} style={{ marginRight: 6, flexShrink: 0, verticalAlign: 'middle' }} />CANCEL</> : '+ NEW GOAL'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 12, padding: 18, marginTop: 10,
            }}>
              {/* Name */}
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Goal name (e.g. 'Reduce Food Budget')"
                style={inputStyle}
              />

              {/* Type */}
              <select value={type} onChange={e => setType(e.target.value as GoalCreate['goal_type'])} style={inputStyle}>
                {Object.entries(GOAL_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Amount + Period */}
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Target amount"
                  style={{ ...inputStyle, flex: 2, margin: 0 }}
                />
                <select value={period} onChange={e => setPeriod(e.target.value as any)}
                  style={{ ...inputStyle, flex: 1, margin: 0 }}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>

              {/* District (optional) — 선택 시 색상 자동 매칭 */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#64748b', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                  District (auto color on select)
                </label>
                <select value={district} onChange={e => handleDistrictChange(e.target.value)} style={inputStyle}>
                  <option value="">All Categories</option>
                  {DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {district && AREA_COLOR_MAP[district] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Auto color: {district}</span>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(p => !p)}
                      style={{
                        fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
                        textDecoration: 'underline', padding: 0,
                      }}
                    >
                      {showColorPicker ? 'Cancel color picker' : 'Change color manually'}
                    </button>
                  </div>
                )}
              </div>

              {/* Color (고급 설정 — 기본 숨김) */}
              {showColorPicker && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#64748b', width: '100%', marginBottom: 4 }}>Custom color</span>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} style={{
                      width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      boxShadow: color === c ? `0 0 0 3px rgba(255,255,255,0.3), 0 0 8px ${c}` : 'none',
                      transition: 'box-shadow 0.2s',
                    }} />
                  ))}
                </div>
              )}
              {!district && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Color:</span>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} style={{
                      width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      boxShadow: color === c ? `0 0 0 3px rgba(255,255,255,0.3), 0 0 8px ${c}` : 'none',
                      transition: 'box-shadow 0.2s',
                    }} />
                  ))}
                </div>
              )}

              <button onClick={submit} style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: 2,
              }}>
                CREATE GOAL
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 10,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.8)',
  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

// ── Main Panel ────────────────────────────────────────────────────────────────

interface Props {
  open:             boolean;
  onClose:          () => void;
  currency?:        string;
  isGuest?:         boolean;
  onGuestReadOnly?: () => void;
}

export function GoalsDashboard({ open, onClose, currency, isGuest, onGuestReadOnly }: Props) {
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [finance, setFinance]    = useState<{ balance: number; currency: string } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [simGoal, setSimGoal]     = useState<Goal | null>(null);
  const [forecastGoal, setForecastGoal] = useState<Goal | null>(null);
  const [forecastData, setForecastData]  = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleForecast = async (goal: Goal) => {
    setForecastGoal(goal);
    setForecastData(null);
    setForecastLoading(true);
    try {
      const data = await fetchGoalForecast(goal.id);
      setForecastData(data);
    } catch (e) {
      console.error('Goal forecast error:', e);
    } finally {
      setForecastLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [dashData, finData] = await Promise.all([
        getGoalsDashboard(),
        fetchFinanceOverview(),
      ]);
      setDashboard(dashData);
      setFinance({ balance: finData.balance, currency: finData.currency || 'USD' });
    } catch (e) {
      console.error('Goals dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      intervalRef.current = setInterval(load, 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [open]);

  const handleAddGoal = async (g: GoalCreate) => {
    if (isGuest && onGuestReadOnly) {
      onGuestReadOnly();
      return;
    }
    try {
      await createGoal(g);
      await load();
    } catch (e) {
      console.error('Create goal error:', e);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (isGuest && onGuestReadOnly) {
      onGuestReadOnly();
      return;
    }
    try {
      await deleteGoal(id);
      setDashboard(prev => prev ? {
        ...prev,
        goals: prev.goals.filter(g => g.id !== id),
        total_goals: prev.total_goals - 1,
      } : prev);
    } catch (e) {
      console.error('Delete goal error:', e);
    }
  };

  const goals = dashboard?.goals ?? [];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="goals-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 200 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 380,
              background: 'rgba(8,14,30,0.96)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(6,182,212,0.15)',
              display: 'flex', flexDirection: 'column',
              zIndex: 9999,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#06b6d4', letterSpacing: 3, marginBottom: 4 }}>
                    FINANCIAL GOALS
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>
                    Goal Tracker
                  </div>
                </div>
                <button onClick={onClose} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#64748b', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>

              {/* Balance card — CountUp + neon glow */}
              {finance && (
                <div style={{
                  marginBottom: 16, padding: '14px 18px', borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.06))',
                  border: '1px solid rgba(6,182,212,0.25)',
                  boxShadow: '0 0 20px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}>
                  <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, marginBottom: 6 }}>
                    ACCOUNT BALANCE
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 800,
                    color: finance.balance >= 0 ? '#06b6d4' : '#ef4444',
                    textShadow: finance.balance >= 0
                      ? '0 0 20px rgba(6,182,212,0.6), 0 0 40px rgba(6,182,212,0.3)'
                      : '0 0 20px rgba(239,68,68,0.5)',
                  }}>
                    <CountUp value={finance.balance} duration={1.2} decimals={2} prefix="" suffix={` ${finance.currency}`} />
                  </div>
                </div>
              )}

              {/* Stats row */}
              {dashboard && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'Total',    value: dashboard.total_goals,    color: '#94a3b8' },
                    { label: 'Active',   value: dashboard.active_goals,   color: '#06b6d4' },
                    { label: 'Achieved', value: dashboard.achieved_goals, color: '#10b981' },
                    { label: 'At Risk',  value: dashboard.at_risk_goals,  color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, textAlign: 'center',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 6px',
                      border: `1px solid ${s.color}20`,
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI portfolio score */}
              {dashboard?.portfolio_score !== null && dashboard?.portfolio_score !== undefined && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>
                    {Math.round(dashboard.portfolio_score * 100)}
                    <span style={{ fontSize: 9, fontWeight: 400 }}>/100</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8b5cf6', letterSpacing: 2 }}>AI PORTFOLIO SCORE</div>
                    {dashboard.savings_rate !== null && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Savings rate {Math.round((dashboard.savings_rate ?? 0) * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable content — overflow protection */}
            <div style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px',
              wordBreak: 'break-word', overflowWrap: 'break-word',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(6,182,212,0.3) transparent',
            }}>
              <AddGoalForm onAdd={handleAddGoal} />

              {loading && !dashboard && (
                <div style={{ textAlign: 'center', padding: 40, color: '#475569', fontSize: 13 }}>
                  <motion.div
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ marginBottom: 10 }}
                  >
                    <Loader2 size={28} strokeWidth={2} color="#475569" />
                  </motion.div>
                  <div>Loading goals...</div>
                </div>
              )}

              {!loading && goals.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '40px 20px',
                  color: '#334155', fontSize: 13, lineHeight: 1.8,
                }}>
                  <Target size={44} strokeWidth={1.5} color="#475569" style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ color: '#475569', marginBottom: 6 }}>No goals yet.</div>
                  <div>Click <span style={{ color: '#06b6d4' }}>+ NEW GOAL</span> above to start tracking your financial milestones.</div>
                </div>
              )}

              <AnimatePresence>
                {goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onSimulate={setSimGoal}
                    onForecast={handleForecast}
                    onDelete={handleDeleteGoal}
                  />
                ))}
              </AnimatePresence>

              {/* AI Advice from M6 — safe parsing, ErrorBoundary로 White Screen 방지 */}
              {(dashboard?.ai_advice?.length ?? 0) > 0 && (
                <ErrorBoundary>
                  <div
                    style={{
                      marginTop: 8,
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      overflowX: 'hidden',
                    }}
                  >
                    <div style={{ fontSize: 10, letterSpacing: 3, color: '#475569', marginBottom: 10 }}>
                      AI INSIGHTS (M6)
                    </div>
                    {dashboard!.ai_advice.slice(0, 3).map((a: unknown, i: number) => (
                      <AIInsightCard key={i} item={a} index={i} />
                    ))}
                  </div>
                </ErrorBoundary>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <button onClick={load} style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1px solid rgba(6,182,212,0.2)',
                background: 'rgba(6,182,212,0.06)',
                color: '#06b6d4', fontSize: 11, cursor: 'pointer', letterSpacing: 2, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <RefreshCw size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> REFRESH
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulation modal */}
      {simGoal && (
        <GoalSimulationModal
          goal={simGoal}
          onClose={() => setSimGoal(null)}
        />
      )}

      {/* Goal Forecast modal (RAG advice + SHAP) */}
      <AnimatePresence>
      {forecastGoal && (
        <GoalForecastModal
          key="forecast-modal"
          goal={forecastGoal}
          data={forecastData}
          loading={forecastLoading}
          onClose={() => { setForecastGoal(null); setForecastData(null); }}
        />
      )}
      </AnimatePresence>
    </>
  );
}

// ── Goal Forecast Modal (RAG advice + SHAP) ─────────────────────────────────

function GoalForecastModal({
  goal,
  data,
  loading,
  onClose,
}: {
  goal: Goal;
  data: any;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(8,14,30,0.98)',
          borderRadius: 16,
          border: '1px solid rgba(139,92,246,0.3)',
          maxWidth: 480, width: '100%', maxHeight: '80vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#8b5cf6', letterSpacing: 2 }}>AI FORECAST</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{goal.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading forecast...</div>}
          {!loading && data?.advice && (
            <ErrorBoundary>
              <AIInsightCard item={data.advice} index={0} />
              {data.advice.shap_contributions?.length > 0 && (
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(139,92,246,0.06)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#8b5cf6', letterSpacing: 2, marginBottom: 10 }}>SHAP CONTRIBUTIONS</div>
                  {data.advice.shap_contributions.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ width: 100, fontSize: 11, color: '#94a3b8' }}>{s.category}</span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(s.shap_value * 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{(s.shap_value * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </ErrorBoundary>
          )}
          {!loading && data && !data.advice && (
            <div style={{ color: '#64748b', fontSize: 13 }}>Goal already achieved or no specific advice available.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
