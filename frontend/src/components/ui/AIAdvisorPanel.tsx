/**
 * AI Advisor Panel — Module 6 RAG-style advice + SHAP contributions
 *
 * Displays actionable financial advice from analytics API.
 * Reuses AIInsightCard for safe JSON parsing and rendering.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2 } from 'lucide-react';
import { AIInsightCard } from './AIInsightCard';
import { ErrorBoundary } from './ErrorBoundary';

interface ShapContribution {
  category: string;
  amount: number;
  share_pct: number;
  shap_value: number;
  direction: string;
  description: string;
}

interface AdvisorItem {
  id?: string;
  title?: string;
  body?: string;
  action_items?: string[];
  estimated_impact?: string;
  supporting_data?: Record<string, unknown>;
  shap_contributions?: ShapContribution[];
  priority?: string;
}

interface AIAdvisorPanelProps {
  open: boolean;
  onClose: () => void;
  advice: AdvisorItem[];
  riskScore?: number;
  loading?: boolean;
}

export function AIAdvisorPanel({
  open,
  onClose,
  advice,
  riskScore = 0,
  loading = false,
}: AIAdvisorPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-advisor-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 200 }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            background: 'rgba(8,14,30,0.98)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(139,92,246,0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            fontFamily: "'Inter', sans-serif",
            boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#8b5cf6',
                    letterSpacing: 3,
                    marginBottom: 4,
                  }}
                >
                  AI ADVISOR
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>
                  Personalized Insights
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#64748b',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
            {riskScore > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background:
                    riskScore >= 60
                      ? 'rgba(239,68,68,0.1)'
                      : riskScore >= 35
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${
                    riskScore >= 60
                      ? 'rgba(239,68,68,0.25)'
                      : riskScore >= 35
                        ? 'rgba(245,158,11,0.25)'
                        : 'rgba(16,185,129,0.2)'
                  }`,
                  fontSize: 12,
                  color: '#94a3b8',
                }}
              >
                Risk Score: <strong>{Math.round(riskScore)}/100</strong>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(139,92,246,0.3) transparent',
            }}
          >
            {loading && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block', fontSize: 24, marginBottom: 10 }}
                >
                  <Loader2 size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
                </motion.div>
                <div>Loading AI insights...</div>
              </div>
            )}
            {!loading && advice.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#475569',
                  fontSize: 13,
                  lineHeight: 1.8,
                }}
              >
                <Bot size={48} strokeWidth={1.5} color="#06b6d4" style={{ marginBottom: 12, opacity: 0.6 }} />
                <div>No personalized advice yet.</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Add transactions and set budget limits to receive AI-powered
                  insights.
                </div>
              </div>
            )}
            {!loading && advice.length > 0 && (
              <ErrorBoundary>
                {advice.map((item, i) => (
                  <div key={item.id || `advice-${i}`} style={{ marginBottom: 16 }}>
                    <AIInsightCard item={item} index={i} />
                    {/* SHAP bar chart when available */}
                    {item.shap_contributions &&
                      Array.isArray(item.shap_contributions) &&
                      item.shap_contributions.length > 0 && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '12px 14px',
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(139,92,246,0.15)',
                            borderRadius: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: '#8b5cf6',
                              letterSpacing: 2,
                              marginBottom: 8,
                            }}
                          >
                            SHAP CONTRIBUTION (XAI)
                          </div>
                          {(item.shap_contributions as ShapContribution[])
                            .slice(0, 5)
                            .map((s, j) => (
                              <div
                                key={j}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  marginBottom: 6,
                                }}
                              >
                                <span
                                  style={{
                                    width: 90,
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {s.category}
                                </span>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 8,
                                    background: 'rgba(255,255,255,0.06)',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${Math.min(s.shap_value * 100, 100)}%`,
                                    }}
                                    transition={{ duration: 0.6, delay: j * 0.1 }}
                                    style={{
                                      height: '100%',
                                      background:
                                        s.direction === 'negative'
                                          ? 'linear-gradient(90deg, #ef4444, #f97316)'
                                          : 'linear-gradient(90deg, #10b981, #06b6d4)',
                                      borderRadius: 4,
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: '#64748b',
                                    width: 36,
                                    textAlign: 'right',
                                  }}
                                >
                                  {(s.shap_value * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                  </div>
                ))}
              </ErrorBoundary>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
