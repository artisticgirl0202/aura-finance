/**
 * AIInsightToast — 통합 알림 시스템 (예산 + AI 인사이트)
 * ──────────────────────────────────────────────────────────────────
 * 우측 하단 단일 위치. Premium Glassmorphism 디자인.
 * Apple Vision Pro 스타일의 심플하고 우아한 UX.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Sparkles, X } from 'lucide-react';
import { forwardRef, useEffect, useRef } from 'react';

export interface UnifiedInsight {
  id: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  icon?: string;
}

const TYPE_CONFIG: Record<string, { Icon: React.ComponentType<Record<string, unknown>>; color: string; borderColor: string }> = {
  info:    { Icon: AlertCircle,   color: '#06b6d4', borderColor: 'rgba(6,182,212,0.4)' },
  warning: { Icon: AlertTriangle, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' },
  success: { Icon: Sparkles,      color: '#10b981', borderColor: 'rgba(16,185,129,0.35)' },
  danger:  { Icon: AlertCircle,   color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)' },
};

const AUTO_MS = 8000;
const MAX_TOASTS = 2;

interface ToastItemProps {
  insight: UnifiedInsight;
  onDismiss: (id: string) => void;
  index: number;
}

const ToastItem = forwardRef<
  HTMLDivElement,
  ToastItemProps
>(function ToastItem({ insight, onDismiss, index }, ref) {
  const cfg = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.info;
  const { Icon } = cfg;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(
      () => onDismiss(insight.id),
      AUTO_MS + index * 400,
    );
    return () => clearTimeout(timerRef.current);
  }, [insight.id, onDismiss, index]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: 'relative',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${cfg.borderColor}`,
        borderRadius: 12,
        boxShadow: `0 0 20px ${cfg.borderColor.replace('0.35', '0.08').replace('0.4', '0.1')}`,
        overflow: 'hidden',
        pointerEvents: 'auto',
        width: '100%',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
      }}>
        <Icon size={20} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.9, color: cfg.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginBottom: 4,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: '#ffffff',
              fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
            }}>
              {insight.title}
            </span>
            <button
              onClick={() => onDismiss(insight.id)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#94a3b8', cursor: 'pointer',
                width: 24, height: 24, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontWeight: 600,
              }}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <p style={{
            margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
            fontFamily: 'var(--font-body)',
          }}>
            {insight.message}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: (AUTO_MS + index * 400) / 1000, ease: 'linear' }}
        style={{
          height: 1, width: '100%',
          background: `linear-gradient(90deg, ${cfg.borderColor}, transparent)`,
          transformOrigin: 'left', opacity: 0.6,
        }}
      />
    </motion.div>
  );
});

interface AIInsightToastProps {
  insights: UnifiedInsight[];
  onDismiss: (id: string) => void;
}

export function AIInsightToast({ insights, onDismiss }: AIInsightToastProps) {
  const display = insights.slice(0, MAX_TOASTS);
  if (display.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 384,
        maxWidth: 'min(384px, calc(100vw - 48px))',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'auto',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <AnimatePresence mode="popLayout">
        {display.map((insight, i) => (
          <ToastItem key={insight.id} insight={insight} onDismiss={onDismiss} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
