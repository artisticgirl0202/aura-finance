/**
 * PanelBackdrop — Blur overlay behind active side panels
 * ─────────────────────────────────────────────────────────────────
 * Focuses attention on the active panel, prevents interaction with background.
 */

import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  visible: boolean;
  onClick?: () => void;
}

export function PanelBackdrop({ visible, onClick }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2999,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            pointerEvents: visible ? 'auto' : 'none',
          }}
          onClick={onClick}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}
