/**
 * BankSyncToast — 연동 완료 축하 알림 ("N개 거래 불러옴")
 * ─────────────────────────────────────────────────────────────────
 * isSilent=false일 때만 표시, 3초 후 자동 사라짐
 */

import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  count: number;
  message?: string;
  onDismiss: () => void;
}

export function BankSyncToast({ count, message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        position: 'fixed',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99996,
        padding: '14px 24px',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,182,212,0.9))',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(6,182,212,0.4)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      🎉 {message ?? `Loaded ${count} transaction${count !== 1 ? 's' : ''}`}
    </motion.div>
  );
}
