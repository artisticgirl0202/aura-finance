/**
 * AuthGate — renders children only when user is authenticated OR in guest mode.
 * While loading JWT from localStorage, shows a full-screen splash.
 * Otherwise redirects to <LoginPage />.
 */

import { motion } from 'framer-motion';
import LoginPage from '../../pages/LoginPage';
import { useAuth } from '../../contexts/AuthContext';
import { AuraLogo } from './AuraLogo';

function LoadingSplash() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#020617',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
    }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.97, 1, 0.97] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(139,92,246,0.25))',
          border: '1px solid rgba(6,182,212,0.5)',
          borderRadius: 16,
          padding: '12px 24px',
          marginBottom: 24,
          boxShadow: '0 0 24px rgba(6,182,212,0.3)',
        }}
      >
        <AuraLogo size={28} />
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 5, color: '#fff' }}>
          AURA
        </span>
      </motion.div>

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(6,182,212,0.15)',
          borderTop: '3px solid #06b6d4',
        }}
      />
    </div>
  );
}

interface Props {
  children: React.ReactNode;
}

export function AuthGate({ children }: Props) {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  if (isLoading) return <LoadingSplash />;

  if (!isAuthenticated && !isGuest) return <LoginPage />;

  return <>{children}</>;
}
