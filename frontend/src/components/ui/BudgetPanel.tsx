/**
 * BudgetPanel — Full-screen budget configuration panel.
 *
 * 역할: 월별 카테고리 지출 예산(Expense Limits)만 관리.
 * 수입/투자 목표는 Goal Tracker 패널에서 통합 관리.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BudgetSettings } from '../../hooks/useBudget';

interface BudgetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  districts: Array<{ name: string; color: string }>;
  currentSettings: BudgetSettings;
  onSave: (settings: BudgetSettings) => void;
  categorySpend: Record<string, number>;
}

// ── Shared input style ───────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-body)',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

// ── Category row ─────────────────────────────────────────────────────────────
function CategoryRow({
  district,
  value,
  spent,
  onChange,
}: {
  district: { name: string; color: string };
  value: string;
  spent: number;
  onChange: (v: string) => void;
}) {
  const limit = parseFloat(value) || 0;
  const ratio = limit > 0 ? spent / limit : 0;
  const barColor =
    ratio >= 1.0 ? '#ef4444' :
    ratio >= 0.8 ? '#f59e0b' :
    district.color;
  const statusText =
    limit <= 0   ? null :
    ratio >= 1.0 ? `+$${(spent - limit).toFixed(0)} over` :
    `$${(limit - spent).toFixed(0)} left`;

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(0,0,0,0.4), ${district.color}08)`,
      border: `1px solid ${district.color}25`,
      borderLeft: `3px solid ${district.color}`,
      borderRadius: 10,
      padding: '12px 14px',
      transition: 'border-color 0.3s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: district.color,
            boxShadow: `0 0 6px ${district.color}`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
            {district.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>Spent</span>
          <span style={{ color: barColor, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            ${spent.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#06b6d4', fontSize: 13, fontFamily: 'var(--font-display)', flexShrink: 0 }}>$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="No limit"
          style={inputBase}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = district.color;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${district.color}20`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {statusText && (
          <span style={{
            fontSize: 11, flexShrink: 0, fontFamily: 'var(--font-display)',
            color: barColor, minWidth: 70, textAlign: 'right',
          }}>
            {statusText}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {limit > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${Math.min(ratio * 100, 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: barColor,
                borderRadius: 2,
                boxShadow: `0 0 6px ${barColor}80`,
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#475569' }}>
            <span>{(ratio * 100).toFixed(0)}%</span>
            <span>${limit.toFixed(0)} limit</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BudgetPanel({
  isOpen,
  onClose,
  districts,
  currentSettings,
  onSave,
  categorySpend,
}: BudgetPanelProps) {
  const [total, setTotal]             = useState('');
  const [categories, setCategories]   = useState<Record<string, string>>({});

  // Sync from saved settings whenever panel opens (expense limits only)
  useEffect(() => {
    if (!isOpen) return;
    setTotal(currentSettings.total > 0 ? currentSettings.total.toString() : '');
    const init: Record<string, string> = {};
    districts.forEach((d) => {
      const v = currentSettings.categories[d.name];
      init[d.name] = v && v > 0 ? v.toString() : '';
    });
    setCategories(init);
  }, [isOpen, currentSettings, districts]);

  const handleSave = () => {
    const settings: BudgetSettings = {
      total: parseFloat(total) || 0,
      categories: {},
      incomeGoal: 0,
      investmentGoal: 0,
    };
    Object.entries(categories).forEach(([name, val]) => {
      settings.categories[name] = parseFloat(val) || 0;
    });
    onSave(settings);
    onClose();
  };

  const totalSpent = Object.values(categorySpend).reduce((a, b) => a + b, 0);
  const totalLimit = parseFloat(total) || 0;
  const totalRatio = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const totalBarColor =
    totalRatio >= 1.0 ? '#ef4444' :
    totalRatio >= 0.9 ? '#f59e0b' :
    '#06b6d4';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            key="budget-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 3000,
            }}
          />

          {/*
            ── Centering wrapper ──────────────────────────────────────
            Centering is handled here with flex so framer-motion
            only controls scale/opacity — never conflicts with translate.
          */}
          <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3001,
            padding: '20px',
            pointerEvents: 'none',
          }}>
            <motion.div
              key="budget-modal"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.94, y: 16  }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: 520,
                maxHeight: 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(5, 7, 20, 0.97)',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: `
                  0 0 0 1px rgba(6,182,212,0.3),
                  0 0 40px rgba(6,182,212,0.08),
                  0 32px 100px rgba(0,0,0,0.9)
                `,
              }}
            >
              {/* Neon top edge */}
              <div style={{
                height: 2, flexShrink: 0,
                background: 'linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent)',
              }} />

              {/* ── Header ─────────────────────────────────────────── */}
              <div style={{
                padding: '18px 22px 16px',
                background: 'linear-gradient(180deg, rgba(6,182,212,0.07) 0%, transparent 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                flexShrink: 0,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{
                      width: 32, height: 32,
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                      border: '1px solid rgba(6,182,212,0.3)',
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>
                      <Wallet size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
                    </div>
                    <h2 style={{
                      margin: 0, fontSize: 18,
                      fontFamily: 'var(--font-display)',
                      background: 'linear-gradient(135deg, #06b6d4 30%, #8b5cf6)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      letterSpacing: '1px',
                    }}>
                      BUDGET SETTINGS
                    </h2>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', paddingLeft: 42 }}>
                    Buildings glow red when you exceed a limit
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: '#64748b',
                    cursor: 'pointer', fontSize: 16,
                    width: 30, height: 30, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* ── Scrollable body (Expense Limits only) ────────────────────────────────── */}
              <div
                className="cyberpunk-scrollbar"
                style={{ flex: 1, overflowY: 'auto', padding: '0 22px 18px' }}
              >
                {/* Total budget card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.07), rgba(139,92,246,0.05))',
                  border: '1px solid rgba(6,182,212,0.2)',
                  borderRadius: 12, padding: '16px 18px',
                  marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: 'var(--font-display)' }}>
                      Total Monthly Budget
                    </label>
                    {totalLimit > 0 && (
                      <span style={{ fontSize: 11, color: totalBarColor, fontFamily: 'var(--font-display)' }}>
                        ${totalSpent.toFixed(0)} / ${totalLimit.toFixed(0)}
                      </span>
                    )}
                  </div>

                  <div style={{ position: 'relative', marginBottom: totalLimit > 0 ? 10 : 0 }}>
                    <span style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: '#06b6d4', fontSize: 20, fontFamily: 'var(--font-display)', pointerEvents: 'none',
                    }}>$</span>
                    <input
                      type="number"
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      placeholder="e.g. 2000"
                      style={{
                        ...inputBase,
                        paddingLeft: 28,
                        fontSize: 22,
                        fontFamily: 'var(--font-display)',
                        background: 'rgba(6,182,212,0.05)',
                        border: '1px solid rgba(6,182,212,0.25)',
                        letterSpacing: '1px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Total progress bar */}
                  {totalLimit > 0 && (
                    <div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <motion.div
                          animate={{ width: `${Math.min(totalRatio * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{
                            height: '100%', background: totalBarColor,
                            borderRadius: 2, boxShadow: `0 0 8px ${totalBarColor}`,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#475569' }}>
                        <span style={{ color: totalBarColor }}>{(totalRatio * 100).toFixed(0)}% used</span>
                        <span>${(totalLimit - totalSpent).toFixed(0)} remaining</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category limits heading */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                }}>
                  <div style={{ height: 1, flex: 1, background: 'rgba(139,92,246,0.2)' }} />
                  <span style={{ fontSize: 10, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'var(--font-display)' }}>
                    Category Limits
                  </span>
                  <div style={{ height: 1, flex: 1, background: 'rgba(139,92,246,0.2)' }} />
                </div>

                {/* Category rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {districts.map((d) => (
                    <CategoryRow
                      key={d.name}
                      district={d}
                      value={categories[d.name] || ''}
                      spent={categorySpend[d.name] || 0}
                      onChange={(v) => setCategories((prev) => ({ ...prev, [d.name]: v }))}
                    />
                  ))}
                </div>
              </div>

              {/* ── Footer (always visible, never scrolls away) ─────── */}
              <div style={{
                padding: '14px 22px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.3)',
                display: 'flex', gap: 10, flexShrink: 0,
              }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '11px 0',
                    background: 'transparent',
                    border: '1px solid rgba(100,116,139,0.3)',
                    borderRadius: 10, color: '#64748b',
                    cursor: 'pointer', fontSize: 13,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(100,116,139,0.6)';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(100,116,139,0.3)';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  CANCEL
                </button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  style={{
                    flex: 2, padding: '11px 0',
                    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    border: 'none', borderRadius: 10,
                    color: 'white', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '1.2px',
                    boxShadow: '0 4px 20px rgba(6,182,212,0.35), 0 0 40px rgba(139,92,246,0.15)',
                  }}
                >
                  SAVE BUDGET
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
