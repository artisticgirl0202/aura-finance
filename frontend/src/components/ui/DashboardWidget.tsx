/**
 * DashboardWidget — Unified widget card (cyberpunk design system)
 * Dark glassmorphism bg, thin neon border, hover glow
 */

import { motion } from 'framer-motion';

interface DashboardWidgetProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
  gridColumn?: '1' | '2' | '1 / -1';
}

const DEFAULT_ACCENT = 'rgba(6, 182, 212, 0.4)';

export function DashboardWidget({
  title,
  icon,
  children,
  accentColor = DEFAULT_ACCENT,
  gridColumn = '1',
}: DashboardWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        boxShadow: `0 0 24px ${accentColor}40, 0 0 48px ${accentColor}20`,
        borderColor: accentColor.replace('0.3', '0.5').replace('0.4', '0.6'),
      }}
      transition={{ duration: 0.2 }}
      className="dashboard-widget-padding"
      style={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.5px solid rgba(6, 182, 212, 0.3)',
        borderRadius: 14,
        gridColumn,
        minHeight: 0,
      }}
    >
      <div
        className="dashboard-widget-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          color: '#64748b',
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
        }}
      >
        {icon && <span style={{ display: 'flex', opacity: 0.9 }}>{icon}</span>}
        {title}
      </div>
      <div style={{ flex: 1, minHeight: 0, width: '100%', minWidth: 0 }}>{children}</div>
    </motion.div>
  );
}
