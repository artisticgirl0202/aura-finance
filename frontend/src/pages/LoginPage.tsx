/**
 * Aura Finance — Login / Register Page
 * ─────────────────────────────────────────────────────────────────
 * Cyberpunk / Glassmorphism design matching the 3D city theme.
 *
 * UX flow:
 *   Landing  → Login form (default)
 *            ↔ Register form (toggle)
 *   Either   → "Continue as Guest" skips auth entirely
 *
 * Security UX (CISO-compliant):
 *   - Shake animation on auth failure (401/403)
 *   - Ambiguous error message from backend (email vs password)
 *   - "Forgot Password?" link after error
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Loader2, Mail, User, Wallet } from 'lucide-react';
import { AuraLogo } from '../components/ui/AuraLogo';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authForgotPassword } from '../api/client';

// ── Decorative animated background grid ──────────────────────────────────────

function CyberGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(6,182,212,0.12) 0%, transparent 70%)',
      }} />
      {/* Grid lines */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.10 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06b6d4" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Floating orbs */}
      {[
        { x: '15%', y: '20%', color: '#06b6d4', size: 180, delay: 0 },
        { x: '80%', y: '70%', color: '#8b5cf6', size: 220, delay: 1.5 },
        { x: '70%', y: '15%', color: '#10b981', size: 140, delay: 3 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orb.color}18 0%, transparent 70%)`,
            filter: 'blur(30px)',
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Input component ───────────────────────────────────────────────────────────

function CyberInput({
  label, type = 'text', value, onChange, placeholder, icon: Icon,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; icon: React.ComponentType<Record<string, unknown>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{
        position: 'relative',
        borderRadius: 10,
        border: `1px solid ${focused ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.1)'}`,
        background: 'transparent',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(6,182,212,0.5)' : 'none',
      }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: focused ? '#06b6d4' : '#64748b', transition: 'color 0.2s', display: 'flex', alignItems: 'center',
        }}>
          <Icon size={18} strokeWidth={2} />
        </span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '14px 14px 14px 44px', background: 'transparent',
            border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, register, continueAsGuest } = useAuth();

  const [mode, setMode]   = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [income, setIncome]     = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const [success, setSuccess]   = useState('');

  const submit = async () => {
    if (mode === 'forgot') {
      if (!email) { setError('Please enter your email.'); return; }
      setBusy(true);
      setError('');
      setSuccess('');
      try {
        await authForgotPassword(email);
        setSuccess('If that email exists, a reset link has been sent.');
        setTimeout(() => { setMode('login'); setSuccess(''); setError(''); }, 2500);
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Request failed. Please try again.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email || !password) { setError('Email and password are required.'); return; }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name) { setError('Display name is required.'); setBusy(false); return; }
        await register({
          email,
          password,
          display_name: name,
          currency,
          monthly_income: parseFloat(income) || 0,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Authentication failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      if (mode === 'login') setShake(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#020617', fontFamily: "var(--font-body), 'Rajdhani', sans-serif",
    }}>
      <CyberGrid />

      {/* Card (shake on auth failure) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          x: shake ? [0, -8, 8, -8, 8, -4, 4, 0] : 0,
        }}
        transition={{
          opacity: { duration: 0.5, ease: 'easeOut' },
          scale: { duration: 0.5, ease: 'easeOut' },
          y: { duration: 0.5, ease: 'easeOut' },
          x: shake ? { duration: 0.5, ease: 'easeOut' } : 0,
        }}
        onAnimationComplete={() => setShake(false)}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 440,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: 12,
          padding: '40px 40px 32px',
          boxShadow: '0 0 60px rgba(6,182,212,0.08), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(6,182,212,0.4)',
              borderRadius: 16,
              padding: '12px 24px',
              marginBottom: 16,
              boxShadow: '0 0 24px rgba(6,182,212,0.2)',
            }}
          >
            <AuraLogo size={32} />
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, color: '#fff' }}>
              AURA
            </span>
          </motion.div>
          <div style={{ fontSize: 12, letterSpacing: 6, color: '#94a3b8', textTransform: 'uppercase' }}>
            Finance Intelligence
          </div>
        </div>

        {/* Mode toggle tabs (hidden in forgot mode) */}
        {mode !== 'forgot' && (
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10,
          padding: 4, marginBottom: 28, gap: 4,
        }}>
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); setShake(false); }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                background: mode === m ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(139,92,246,0.25))' : 'transparent',
                color: mode === m ? '#06b6d4' : '#64748b',
                borderBottom: mode === m ? '2px solid #06b6d4' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>
        )}

        {/* Form / Forgot Password view */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'forgot' ? 10 : (mode === 'login' ? -10 : 10) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'forgot' ? -10 : (mode === 'login' ? 10 : -10) }}
            transition={{ duration: 0.2 }}
          >
            {mode === 'forgot' ? (
              <>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
                  Enter your email to receive a password reset link.
                </p>
            <CyberInput label="Email" type="email" value={email} onChange={setEmail}
              placeholder="you@example.com" icon={Mail} />
              </>
            ) : (
              <>
            {mode === 'register' && (
              <CyberInput label="Display Name" value={name} onChange={setName}
                placeholder="Your name" icon={User} />
            )}
            <CyberInput label="Email" type="email" value={email} onChange={setEmail}
              placeholder="you@example.com" icon={Mail} />
            <CyberInput label="Password" type="password" value={password} onChange={setPassword}
              placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'} icon={Lock} />

            {mode === 'register' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <CyberInput label="Monthly Income" type="number" value={income} onChange={setIncome}
                    placeholder="0.00" icon={Wallet} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{
                      width: '100%', padding: '14px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                      color: '#e2e8f0', fontSize: 14, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {['USD','EUR','GBP','SEK','KRW','JPY','CAD','AUD'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Success toast */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 14,
                color: '#6ee7b7',
                fontSize: 13,
              }}
            >
              ✓ {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error (Danger color, prominent) */}
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
                marginBottom: 14,
                color: '#fca5a5',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forgot Password (fade-in after error, login mode only) */}
        <AnimatePresence>
          {error && mode === 'login' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              style={{ marginBottom: 16, textAlign: 'center' }}
            >
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); setShake(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#06b6d4',
                  fontSize: 12,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                Forgot password?
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to Sign In (forgot mode only) */}
        {mode === 'forgot' && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Submit button */}
        <motion.button
          whileHover={{ scale: busy ? 1 : 1.02 }}
          whileTap={{ scale: busy ? 1 : 0.98 }}
          onClick={submit}
          disabled={busy}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: busy ? 'rgba(6,182,212,0.3)' : '#0891b2',
            color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer',
            boxShadow: busy ? 'none' : '0 0 20px rgba(6,182,212,0.35)',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "var(--font-display), 'Orbitron', sans-serif",
          }}
          onMouseEnter={(e) => {
            if (!busy) e.currentTarget.style.background = '#06b6d4';
          }}
          onMouseLeave={(e) => {
            if (!busy) e.currentTarget.style.background = '#0891b2';
          }}
        >
          {busy
            ? <><Loader2 size={16} strokeWidth={2} className="animate-spin" style={{ marginRight: 8, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }} />Processing…</>
            : mode === 'forgot'
              ? 'Send Reset Link'
              : mode === 'login'
                ? '→ Enter Aura'
                : '→ Create Account'
          }
        </motion.button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: '#475569', fontSize: 12 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Guest mode */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={continueAsGuest}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            color: '#94a3b8', fontSize: 13, cursor: 'pointer', letterSpacing: 1,
            transition: 'all 0.2s',
          }}
        >
          👁 Continue as Guest  <span style={{ color: '#475569', fontSize: 11 }}>(no account needed)</span>
        </motion.button>

        {/* Footer */}
        <p style={{
          textAlign: 'center', color: '#334155', fontSize: 11,
          marginTop: 24, marginBottom: 0, letterSpacing: 1,
        }}>
          Aura Finance · AI-Powered Financial Intelligence
        </p>
      </motion.div>
    </div>
  );
}
