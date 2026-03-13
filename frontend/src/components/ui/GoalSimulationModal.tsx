/**
 * Aura Finance — Goal Simulation (What-if) Modal
 * ──────────────────────────────────────────────────────────────────
 * Interactive "What if I save/spend X more per month?" calculator.
 * Calls GET /goals/simulate and renders animated projection chart.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Trophy, Zap } from 'lucide-react';
import { useState } from 'react';
import { Goal, simulateGoal } from '../../api/client';

interface SimResult {
  scenario_label:     string;
  months_to_goal:     number | null;
  final_amount:       number;
  goal_achieved:      boolean;
  monthly_pace:       number;
  target_amount:      number;
  surplus_or_deficit: number;
  message:            string;
  projection_months:  number[];
  projection_amounts: number[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

// ── Mini projection chart ─────────────────────────────────────────────────────

function ProjectionChart({ months: _months, amounts, target, color }: {
  months: number[]; amounts: number[]; target: number; color: string;
}) {
  const safeAmounts = amounts ?? [];
  if (!safeAmounts.length) return null;
  const W = 280, H = 120;
  const maxA = Math.max(...safeAmounts, target) * 1.05;
  const minA = 0;
  const range = maxA - minA || 1;

  const divisor = Math.max(1, safeAmounts.length - 1);
  const pts = safeAmounts.map((a, i) => {
    const x = (i / divisor) * W;
    const y = H - ((a - minA) / range) * H;
    return `${x},${y}`;
  });

  const targetY = H - ((target - minA) / range) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      {/* Target line */}
      <line x1={0} y1={targetY} x2={W} y2={targetY}
        stroke="#10b981" strokeWidth={1} strokeDasharray="6 3" opacity={0.5} />
      <text x={4} y={targetY - 4} fontSize={9} fill="#10b981" opacity={0.7}>Target</text>

      {/* Area fill */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <motion.polygon
        fill="url(#areaGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        points={`0,${H} ${pts.join(' ')} ${W},${H}`}
      />

      {/* Line */}
      <motion.polyline
        points={pts.join(' ')}
        fill="none" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* End dot */}
      {safeAmounts.length > 1 && (
        <motion.circle
          cx={W}
          cy={H - ((safeAmounts[safeAmounts.length - 1] - minA) / range) * H}
          r={5} fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 1.1, type: 'spring' }}
        />
      )}
    </svg>
  );
}

// ── Slider input ──────────────────────────────────────────────────────────────

function CyberSlider({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
          {label}
        </label>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4' }}>
          {unit === '$' ? fmtCurrency(value) : `${value}${unit ?? ''}`}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', accentColor: '#06b6d4',
          height: 4, cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#334155' }}>
        <span>{unit === '$' ? fmtCurrency(min) : `${min}${unit ?? ''}`}</span>
        <span>{unit === '$' ? fmtCurrency(max) : `${max}${unit ?? ''}`}</span>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  goal:    Goal;
  onClose: () => void;
}

export function GoalSimulationModal({ goal, onClose }: Props) {
  const [income,      setIncome]      = useState(3000);
  const [pace,        setPace]        = useState(500);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [result,      setResult]      = useState<SimResult | null>(null);
  const [loading,     setLoading]     = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const data = await simulateGoal({
        goal_type:      goal.goal_type,
        target_amount:  goal.target_amount,
        monthly_income: income,
        current_pace:   pace,
        months_ahead:   monthsAhead,
      });
      setResult(data);
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 200 }}
          style={{
            width: '100%', maxWidth: 520,
            background: 'rgba(8,14,30,0.98)',
            border: `1px solid ${goal.color}40`,
            borderRadius: 20, padding: 32,
            fontFamily: "'Inter', sans-serif",
            maxHeight: '90vh', overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${goal.color}30 transparent`,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: goal.color, letterSpacing: 3, marginBottom: 6 }}>WHAT-IF SIMULATOR</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>{goal.name}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                Target: <span style={{ color: '#94a3b8' }}>{fmtCurrency(goal.target_amount)}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#64748b', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Input sliders */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: 14,
            padding: '20px 24px', marginBottom: 20,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: '#475569', marginBottom: 16 }}>SCENARIO INPUTS</div>
            <CyberSlider
              label="Monthly Income" value={income}
              min={500} max={20000} step={100}
              onChange={setIncome} unit="$"
            />
            <CyberSlider
              label={goal.goal_type === 'expense_limit' ? 'Monthly Spend' : 'Monthly Contribution'}
              value={pace}
              min={0} max={Math.max(income, goal.target_amount / 6)} step={50}
              onChange={setPace} unit="$"
            />
            <CyberSlider
              label="Projection Window"
              value={monthsAhead}
              min={1} max={60} step={1}
              onChange={setMonthsAhead} unit=" mo"
            />
          </div>

          {/* Run button */}
          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={run}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: loading ? 'rgba(6,182,212,0.15)' : `linear-gradient(135deg, ${goal.color}, #8b5cf6)`,
              color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 2,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : `0 0 20px ${goal.color}40`,
              marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? <><Loader2 size={14} strokeWidth={2} style={{ flexShrink: 0 }} />Simulating...</> : 'RUN SIMULATION'}
          </motion.button>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {/* Outcome banner */}
                <div style={{
                  padding: '16px 20px', borderRadius: 12, marginBottom: 20,
                  background: result.goal_achieved ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${result.goal_achieved ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6,
                    color: result.goal_achieved ? '#10b981' : '#f59e0b' }}>
                    {result.goal_achieved ? <><Trophy size={16} strokeWidth={2} style={{ marginRight: 8, flexShrink: 0 }} />Goal Achievable!</> : <><Zap size={16} strokeWidth={2} style={{ marginRight: 8, flexShrink: 0 }} />Adjust Your Pace</>}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                    {result.message}
                  </div>
                </div>

                {/* Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    {
                      label: 'Months to Goal',
                      value: result.months_to_goal !== null ? `${result.months_to_goal} mo` : 'N/A',
                      color: result.goal_achieved ? '#10b981' : '#f59e0b',
                    },
                    {
                      label: 'Final Amount',
                      value: fmtCurrency(result.final_amount ?? 0),
                      color: goal?.color ?? '#06b6d4',
                    },
                    {
                      label: 'Monthly Pace',
                      value: fmtCurrency(result.monthly_pace ?? 0),
                      color: '#8b5cf6',
                    },
                    {
                      label: (result.surplus_or_deficit ?? 0) >= 0 ? 'Surplus' : 'Deficit',
                      value: fmtCurrency(Math.abs(result.surplus_or_deficit ?? 0)),
                      color: result.surplus_or_deficit >= 0 ? '#10b981' : '#ef4444',
                    },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                      padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>{m.label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>

                {/* Projection chart */}
                {(result.projection_amounts?.length ?? 0) > 1 && (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', borderRadius: 12,
                    padding: '16px 16px 8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: '#475569', marginBottom: 12 }}>
                      PROJECTION ({result.projection_months?.length ?? 0} MONTHS)
                    </div>
                    <ProjectionChart
                      months={result.projection_months ?? []}
                      amounts={result.projection_amounts ?? []}
                      target={result.target_amount ?? 0}
                      color={goal?.color ?? '#06b6d4'}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
                      <span>Month 1</span>
                      <span>Month {(result.projection_months ?? [])[(result.projection_months?.length ?? 1) - 1] ?? 1}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
