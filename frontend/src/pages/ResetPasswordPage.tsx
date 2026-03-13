/**
 * Aura Finance — 비밀번호 재설정 페이지
 * ─────────────────────────────────────────────────────────────────
 * URL: /reset-password?token=...
 * 일회성 토큰으로 새 비밀번호 설정.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AuraLogo } from '../components/ui/AuraLogo';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authResetPassword } from '../api/client';

function CyberGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(6,182,212,0.12) 0%, transparent 70%)',
      }} />
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.10 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-reset" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06b6d4" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-reset)" />
      </svg>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please check the link in your email.');
  }, [token]);

  const submit = async () => {
    setError('');
    if (!token) return;
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await authResetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Reset failed. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#020617', fontFamily: "var(--font-body), 'Rajdhani', sans-serif",
      }}>
        <CyberGrid />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'relative', zIndex: 1, textAlign: 'center',
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(6,182,212,0.3)', borderRadius: 12,
            padding: 48, maxWidth: 400,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
            Password changed successfully.
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Redirecting to login...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#020617', fontFamily: "'Inter', sans-serif",
    }}>
      <CyberGrid />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 440,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: 12,
          padding: '40px 40px 32px',
          boxShadow: '0 0 60px rgba(6,182,212,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(6,182,212,0.4)',
            borderRadius: 16,
            padding: '10px 20px',
            marginBottom: 12,
            boxShadow: '0 0 24px rgba(6,182,212,0.2)',
          }}>
            <AuraLogo size={28} />
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, color: '#fff' }}>AURA</span>
          </div>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#94a3b8', textTransform: 'uppercase' }}>
            Reset Password
          </div>
        </div>

        {!token ? (
          <div style={{ textAlign: 'center', color: '#fca5a5', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={{
                  width: '100%', padding: '14px 14px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                  color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(6,182,212,0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.5)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{
                  width: '100%', padding: '14px 14px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                  color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(6,182,212,0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.5)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.45)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 16,
                    color: '#fca5a5',
                    fontSize: 13,
                  }}
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <motion.button
          whileHover={{ scale: token && !busy ? 1.02 : 1 }}
          whileTap={{ scale: token && !busy ? 0.98 : 1 }}
          onClick={token ? submit : () => navigate('/')}
          disabled={busy || !token}
          onMouseEnter={(e) => {
            if (token && !busy) e.currentTarget.style.background = '#06b6d4';
          }}
          onMouseLeave={(e) => {
            if (token && !busy) e.currentTarget.style.background = '#0891b2';
          }}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: busy || !token ? 'rgba(6,182,212,0.3)' : '#0891b2',
            color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', cursor: busy || !token ? 'default' : 'pointer',
            boxShadow: busy || !token ? 'none' : '0 0 20px rgba(6,182,212,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "var(--font-display), 'Orbitron', sans-serif",
          }}
        >
          {busy ? <><Loader2 size={16} strokeWidth={2} style={{ flexShrink: 0, marginRight: 8 }} />Processing…</> : token ? 'Reset Password' : 'Back to Login'}
        </motion.button>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', color: '#64748b', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
            }}
          >
            ← Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
