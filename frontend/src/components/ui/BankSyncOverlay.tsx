/**
 * BankSyncOverlay — 은행 연동 직후 "데이터 동기화 중..." 로딩
 * ─────────────────────────────────────────────────────────────────
 * 방금 연동 완료 시에만 표시, 새로고침 시에는 절대 노출 안 함
 */

import { motion } from 'framer-motion';

interface Props {
  visible: boolean;
}

export function BankSyncOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99995,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '3px solid rgba(6,182,212,0.3)',
          borderTopColor: '#06b6d4',
        }}
      />
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#e2e8f0',
        letterSpacing: 1,
      }}>
        Syncing data...
      </div>
    </motion.div>
  );
}
