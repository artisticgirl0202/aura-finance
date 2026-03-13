/**
 * Main Control Panel — collapsible Glassmorphism panel.
 * Includes Expense / Income / Investment tab switcher.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { AlertTriangle, BarChart2, Banknote, CheckCircle2, Circle, Rocket, Search, Trash2, TrendingUp, Wallet, X, Zap } from 'lucide-react';
import { AuraLogo } from './AuraLogo';

export type ActiveTab = 'expense' | 'income' | 'investment' | 'stats';

const TAB_ICONS = {
  expense: Banknote,
  income: Wallet,
  investment: TrendingUp,
  stats: BarChart2,
};

const TABS: { id: ActiveTab; label: string; color: string }[] = [
  { id: 'expense',    label: 'EXPENSE', color: '#ef4444' },
  { id: 'income',     label: 'INCOME',  color: '#10b981' },
  { id: 'investment', label: 'INVEST',  color: '#3b82f6' },
  { id: 'stats',      label: 'STATS',   color: '#06b6d4' },
];

interface ControlPanelProps {
  bankConnected: boolean;
  onConnectBank: () => void;
  isGuest?: boolean;
  onExitGuest?: () => void;
  onOpenBudget: () => void;
  simulationEnabled: boolean;
  simulationConnected: boolean;
  simulationError: string | null;
  onToggleSimulation: () => void;
  inputDescription: string;
  inputAmount: string;
  loading: boolean;
  error: string | null;
  transactionCount: number;
  onInputDescriptionChange: (value: string) => void;
  onInputAmountChange: (value: string) => void;
  onClassify: () => void;
  onClear: () => void;
  onTestSamples: () => void;
  isGenerating?: boolean;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function ControlPanel({
  bankConnected,
  onConnectBank,
  isGuest = false,
  onExitGuest,
  onOpenBudget,
  simulationEnabled,
  simulationConnected,
  simulationError,
  onToggleSimulation,
  inputDescription,
  inputAmount,
  loading,
  error,
  transactionCount,
  onInputDescriptionChange,
  onInputAmountChange,
  onClassify,
  onClear,
  onTestSamples,
  isGenerating = false,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        width: collapsed ? 'auto' : '300px',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'rgba(8, 10, 28, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(6,182,212,0.15)',
          color: 'white',
          overflow: 'hidden',
        }}
      >
        {/* ── Header row (always visible) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: collapsed ? '12px 14px' : '16px 18px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            {/* Status dot */}
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: simulationEnabled && simulationConnected ? '#10b981' : '#06b6d4',
              boxShadow: `0 0 8px ${simulationEnabled && simulationConnected ? '#10b981' : '#06b6d4'}`,
              flexShrink: 0,
            }} />
            <AuraLogo size={28} style={{ marginRight: 4 }} />
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '1px',
            }}>
              AURA
            </span>
          </div>

          {/* Collapsed: quick-action bar */}
          {collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={onToggleSimulation}
                title={simulationEnabled ? 'Stop Simulation' : 'Start Simulation'}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: simulationEnabled
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: simulationEnabled
                    ? '0 0 12px rgba(239,68,68,0.5)'
                    : '0 0 12px rgba(6,182,212,0.4)',
                }}
              >
                {simulationEnabled ? '⏹' : '▶'}
              </button>
              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-display)' }}>
                {transactionCount}tx
              </span>
            </div>
          )}

          {/* Collapse toggle */}
          <motion.button
            onClick={() => setCollapsed((c) => !c)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              marginLeft: '8px',
              background: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: '8px',
              color: '#06b6d4',
              fontSize: '14px',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6,182,212,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(6,182,212,0.1)')}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'inline-block', lineHeight: 1 }}
            >
              ▲
            </motion.span>
          </motion.button>
        </div>

        {/* ── Expandable body ── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '14px 18px 18px' }}>

                {/* ── Mode tabs ── */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: '10px',
                  padding: '4px',
                  marginBottom: '12px',
                }}>
                  {TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        whileTap={{ scale: 0.96 }}
                        style={{
                          flex: 1,
                          padding: '7px 4px',
                          borderRadius: '7px',
                          border: 'none',
                          background: active
                            ? `linear-gradient(135deg, ${tab.color}30, ${tab.color}18)`
                            : 'transparent',
                          color: active ? tab.color : '#475569',
                          fontSize: '10px',
                          fontFamily: 'var(--font-display)',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          letterSpacing: '0.5px',
                          boxShadow: active ? `0 0 10px ${tab.color}30, inset 0 0 0 1px ${tab.color}40` : 'none',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        {(() => {
                          const Icon = TAB_ICONS[tab.id];
                          return <Icon size={14} strokeWidth={2} color={active ? tab.color : '#475569'} style={{ flexShrink: 0 }} />;
                        })()}
                        <span>{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Budget settings */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenBudget}
                  style={{
                    width: '100%', padding: '11px', marginBottom: '8px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139,92,246,0.4)',
                    background: 'rgba(139,92,246,0.1)',
                    color: '#a78bfa',
                    fontSize: '13px', fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(139,92,246,0.2)',
                    transition: 'all 0.3s',
                    letterSpacing: '0.5px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
                >
                  BUDGET SETTINGS
                </motion.button>

                {/* Bank connect */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConnectBank}
                  disabled={bankConnected}
                  style={{
                    width: '100%',
                    padding: '11px',
                    marginBottom: '8px',
                    borderRadius: '10px',
                    border: 'none',
                    background: bankConnected
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    cursor: bankConnected ? 'not-allowed' : 'pointer',
                    boxShadow: bankConnected
                      ? '0 0 18px rgba(16,185,129,0.4)'
                      : '0 0 18px rgba(245,158,11,0.4)',
                    opacity: bankConnected ? 0.8 : 1,
                    transition: 'all 0.3s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {bankConnected ? (
                    <><CheckCircle2 size={16} strokeWidth={2} style={{ flexShrink: 0 }} />BANK CONNECTED</>
                  ) : (
                    <>CONNECT BANK</>
                  )}
                </motion.button>

                {!bankConnected && (
                  <div style={{ marginBottom: '10px', fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
                    Connect to Tink Sandbox for real data
                  </div>
                )}

                {/* Simulation toggle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onToggleSimulation}
                  style={{
                    width: '100%',
                    padding: '11px',
                    marginBottom: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: simulationEnabled
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    boxShadow: simulationEnabled
                      ? '0 0 18px rgba(239,68,68,0.5)'
                      : '0 0 18px rgba(6,182,212,0.4)',
                    transition: 'all 0.3s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {simulationEnabled ? 'STOP SIMULATION' : <><Zap size={16} strokeWidth={2} style={{ flexShrink: 0 }} />LIVE SIMULATION</>}
                </motion.button>

                {/* AI Stress Test — 포트폴리오 킬러 피처 */}
                <motion.button
                  whileHover={!isGenerating ? { scale: 1.02 } : undefined}
                  whileTap={!isGenerating ? { scale: 0.98 } : undefined}
                  onClick={onTestSamples}
                  disabled={isGenerating}
                  title="Generates sample data to test AI auto-categorization and rate-limit fallbacks."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    marginBottom: '10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(6,182,212,0.6)',
                    background: isGenerating
                      ? 'rgba(6,182,212,0.08)'
                      : 'transparent',
                    color: isGenerating ? '#64748b' : '#06b6d4',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.5px',
                    transition: 'all 0.3s',
                    boxShadow: isGenerating
                      ? 'none'
                      : '0 0 15px rgba(6,182,212,0.4), inset 0 0 0 1px rgba(6,182,212,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = 'rgba(6,182,212,0.2)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(6,182,212,0.5), inset 0 0 0 1px rgba(6,182,212,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(6,182,212,0.4), inset 0 0 0 1px rgba(6,182,212,0.1)';
                    }
                  }}
                >
                  {isGenerating ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(6,182,212,0.3)',
                          borderTopColor: '#06b6d4',
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      />
                      <span>GENERATING...</span>
                    </>
                  ) : (
                    <>
                      <Rocket size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span>Run AI Stress Test</span>
                    </>
                  )}
                </motion.button>

                {/* Simulation status */}
                <AnimatePresence>
                  {simulationEnabled && simulationConnected && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        fontSize: '11px',
                        color: '#10b981',
                        textAlign: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Circle size={10} fill="#10b981" color="#10b981" style={{ flexShrink: 0 }} />
                      Live Mode Active • Auto-generating every 3s
                    </motion.div>
                  )}
                  {simulationEnabled && !simulationConnected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(251,191,36,0.1)',
                        border: '1px solid rgba(251,191,36,0.3)',
                        fontSize: '11px',
                        color: '#fbbf24',
                        textAlign: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Circle size={10} fill="#fbbf24" color="#fbbf24" style={{ flexShrink: 0 }} />
                      Connecting to server...
                    </motion.div>
                  )}
                  {simulationError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        fontSize: '11px',
                        color: '#ef4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                      {simulationError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Manual input (only when simulation off) */}
                <AnimatePresence>
                  {!simulationEnabled && (
                    <motion.div
                      key="manual"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{
                          display: 'block', marginBottom: '4px',
                          fontSize: '10px', color: '#94a3b8',
                          fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          Merchant Name
                        </label>
                        <input
                          type="text"
                          value={inputDescription}
                          onChange={(e) => onInputDescriptionChange(e.target.value)}
                          placeholder="e.g., STARBUCKS SEOUL"
                          onKeyDown={(e) => e.key === 'Enter' && onClassify()}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(6,182,212,0.3)',
                            background: 'rgba(0,0,0,0.4)',
                            color: 'white',
                            fontSize: '13px',
                            outline: 'none',
                            fontFamily: 'var(--font-body)',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)';
                            e.currentTarget.style.boxShadow = '0 0 12px rgba(6,182,212,0.25)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{
                          display: 'block', marginBottom: '4px',
                          fontSize: '10px', color: '#94a3b8',
                          fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          value={inputAmount}
                          onChange={(e) => onInputAmountChange(e.target.value)}
                          placeholder="100"
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(6,182,212,0.3)',
                            background: 'rgba(0,0,0,0.4)',
                            color: 'white',
                            fontSize: '13px',
                            outline: 'none',
                            fontFamily: 'var(--font-body)',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)';
                            e.currentTarget.style.boxShadow = '0 0 12px rgba(6,182,212,0.25)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={onClassify}
                          disabled={loading}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: loading
                              ? 'rgba(71,85,105,0.5)'
                              : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-display)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 4px 12px rgba(6,182,212,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          {loading ? 'ANALYZING...' : <><Search size={14} strokeWidth={2} style={{ flexShrink: 0 }} />CLASSIFY</>}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={onClear}
                          title="Clear all"
                          style={{
                            padding: '10px 13px',
                            borderRadius: '8px',
                            border: '1px solid rgba(6,182,212,0.3)',
                            background: 'rgba(0,0,0,0.4)',
                            color: '#06b6d4',
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        fontSize: '11px',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Search bar ── */}
                <div style={{ marginTop: '10px' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', marginBottom: '4px',
                    fontSize: '10px', color: '#94a3b8',
                    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    <Search size={12} strokeWidth={2} style={{ marginRight: 6, flexShrink: 0, opacity: 0.8 }} />
                    Search Transactions
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="e.g. Starbucks, Shopping…"
                      style={{
                        width: '100%', padding: '8px 30px 8px 10px',
                        borderRadius: '8px',
                        border: `1px solid ${searchQuery ? 'rgba(6,182,212,0.6)' : 'rgba(6,182,212,0.25)'}`,
                        background: 'rgba(0,0,0,0.4)',
                        color: 'white', fontSize: '12px', outline: 'none',
                        fontFamily: 'var(--font-body)', boxSizing: 'border-box',
                        boxShadow: searchQuery ? '0 0 10px rgba(6,182,212,0.2)' : 'none',
                        transition: 'all 0.2s',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.7)'; }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = searchQuery ? 'rgba(6,182,212,0.6)' : 'rgba(6,182,212,0.25)'; }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => onSearchChange('')}
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: '#64748b',
                          cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1,
                        }}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#06b6d4' }}>
                      Highlighting buildings matching "{searchQuery}"
                    </div>
                  )}
                </div>

                {/* Stats footer */}
                <div style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(6,182,212,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {/* Guest CTA — Sign Up / Log In */}
                  {isGuest && onExitGuest && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onExitGuest}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(6,182,212,0.6)',
                        background: 'rgba(6,182,212,0.12)',
                        color: '#06b6d4',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        cursor: 'pointer',
                        letterSpacing: '0.8px',
                        boxShadow: '0 0 15px rgba(6,182,212,0.4)',
                        transition: 'all 0.25s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(6,182,212,0.25)';
                        e.currentTarget.style.boxShadow = '0 0 22px rgba(6,182,212,0.55)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(6,182,212,0.12)';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(6,182,212,0.4)';
                      }}
                    >
                      Sign Up / Log In
                    </motion.button>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Active Transactions:{' '}
                      <span style={{ color: '#06b6d4', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '13px' }}>
                        {transactionCount}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>
                      Click buildings to explore
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
