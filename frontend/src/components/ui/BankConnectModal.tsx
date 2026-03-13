/**
 * Aura Finance — Bank Connect Modal
 * ──────────────────────────────────────────────────────────────────
 * Guides the user through Tink Open Banking Link connection:
 *
 *  Step 1: "Connect Your Bank" landing card (feature highlights)
 *  Step 2: Loading → calls /banking/auth/link → opens Tink popup
 *  Step 3: Polling for callback completion (popup posts message)
 *  Step 4: Success screen showing fetched accounts
 *
 * The popup approach avoids leaving the 3D city view.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Globe, Landmark, Lock, Target, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createAuthLink, exchangeAuthCode, getAccounts, Account } from '../../api/banking';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'landing' | 'connecting' | 'waiting' | 'success' | 'error';

// ── Feature bullet ────────────────────────────────────────────────────────────

function FeaturePill({ icon: Icon, text }: { icon: React.ComponentType<Record<string, unknown>>; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon size={18} strokeWidth={2} color="#06b6d4" /></div>
      <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

// ── Animated spinner ──────────────────────────────────────────────────────────

function Spinner({ color = '#06b6d4' }: { color?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      style={{
        width: 44, height: 44, borderRadius: '50%',
        border: `3px solid rgba(255,255,255,0.08)`,
        borderTop: `3px solid ${color}`,
        boxShadow: `0 0 12px ${color}40`,
      }}
    />
  );
}

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ acc }: { acc: Account }) {
  const typeColors: Record<string, string> = {
    CHECKING: '#06b6d4', SAVINGS: '#10b981',
    CREDIT:   '#ef4444', INVESTMENT: '#8b5cf6',
  };
  const color = typeColors[acc.type?.toUpperCase()] ?? '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,0.03)', borderRadius: 10,
        padding: '12px 14px', marginBottom: 8,
        border: `1px solid ${color}20`,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {acc.type?.toUpperCase() === 'SAVINGS' ? <Wallet size={20} strokeWidth={2} color={color} /> :
         acc.type?.toUpperCase() === 'CREDIT'  ? <CreditCard size={20} strokeWidth={2} color={color} /> :
         acc.type?.toUpperCase() === 'INVESTMENT' ? <TrendingUp size={20} strokeWidth={2} color={color} /> : <Banknote size={20} strokeWidth={2} color={color} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {acc.name}
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>{acc.type}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color }}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency', currency: acc.currency || 'SEK', maximumFractionDigits: 0,
          }).format(acc.balance ?? 0)}
        </div>
        <div style={{ fontSize: 10, color: '#334155' }}>{acc.currency}</div>
      </div>
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  onClose:      () => void;
  onConnected?: (payload: { accessToken: string; transactionCount: number }) => void;
}

export function BankConnectModal({ onClose, onConnected }: Props) {
  const [step,     setStep]     = useState<Step>('landing');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const popupRef = useRef<Window | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cross-window message listener (ref로 최신 onConnected 유지, 무한 루프 방지) ─────────────────────────
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      if (ev.data?.type !== 'TINK_CALLBACK') return;

      const { status, code, error, transaction_count, access_token: msgToken } = ev.data as {
        type: string;
        status?: string;
        code?: string;
        error?: string;
        transaction_count?: number;
        access_token?: string;
      };

      popupRef.current?.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      setStep('connecting');

      try {
        let accessToken: string;

        if (status === 'success') {
          accessToken = msgToken || localStorage.getItem('tink_access_token') || '';
          if (!accessToken) throw new Error('Token not found');
        } else if (code) {
          const tokenRes = await exchangeAuthCode(code);
          accessToken = tokenRes.access_token;
          localStorage.setItem('tink_access_token', accessToken);
        } else {
          throw new Error(error || 'Authentication failed');
        }

        const accs = await getAccounts(accessToken);
        setAccounts(accs);
        setStep('success');
        onConnectedRef.current?.({ accessToken, transactionCount: transaction_count ?? 0 });
      } catch (e: any) {
        setErrorMsg(e?.response?.data?.detail ?? e?.message ?? error ?? 'Token exchange failed.');
        setStep('error');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // 의존성 제거 — ref 사용으로 중복 호출 방지

  const startConnection = async () => {
    setStep('connecting');
    try {
      const userId = `aura_user_${Date.now()}`;
      const redirectUri = `${window.location.origin}/callback`;
      const { auth_url } = await createAuthLink(userId, redirectUri);

      const popup = window.open(auth_url, 'tink_link',
        'width=600,height=700,scrollbars=yes,resizable=yes');
      popupRef.current = popup;
      setStep('waiting');

      // Fallback polling: detect popup close
      pollingRef.current = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollingRef.current!);
          // If still waiting, user closed popup manually
          setStep('landing');
        }
      }, 1500);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail ?? e?.message ?? 'Could not create auth link.');
      setStep('error');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      popupRef.current?.close();
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="bank-connect-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99990,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="bank-connect-card"
          initial={{ scale: 0.92, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24 }}
          style={{
            width: '100%', maxWidth: 460,
            background: 'rgba(8,14,30,0.97)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 20, padding: 32,
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 0 60px rgba(6,182,212,0.08)',
          }}
        >
          {/* Close */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#64748b', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          <AnimatePresence mode="wait">

            {/* ── LANDING ────────────────────────────────────────────────────── */}
            {step === 'landing' && (
              <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px',
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                    border: '1px solid rgba(6,182,212,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                  }}>🏦</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
                    Connect Your Bank
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                    Securely link your accounts via <span style={{ color: '#06b6d4' }}>Tink Open Banking</span> to see real transactions in your 3D city.
                  </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <FeaturePill icon={Lock} text="Bank-level security (OAuth 2.0) — Aura never stores your credentials" />
                  <FeaturePill icon={Zap} text="Real-time AI classification of every transaction" />
                  <FeaturePill icon={Globe} text="Supports 3,000+ banks across Europe & North America" />
                  <FeaturePill icon={Target} text="Instant 3D city visualization of your spending patterns" />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 24, fontSize: 11,
                  color: '#d97706',
                }}>
                  <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                  Using Tink Sandbox — demo bank data, no real accounts linked.
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={startConnection}
                  style={{
                    width: '100%', padding: '16px 24px', borderRadius: 12, border: '2px solid rgba(6,182,212,0.8)',
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))',
                    color: '#06b6d4', fontSize: 15, fontWeight: 700, letterSpacing: 1.5,
                    cursor: 'pointer',
                    boxShadow: '0 0 32px rgba(6,182,212,0.5), inset 0 0 20px rgba(6,182,212,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  }}
                >
                  <Landmark size={22} strokeWidth={2} style={{ flexShrink: 0 }} />
                  Securely Connect to Your Bank
                </motion.button>
              </motion.div>
            )}

            {/* ── CONNECTING / WAITING ──────────────────────────────────────── */}
            {(step === 'connecting' || step === 'waiting') && (
              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <Spinner />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
                  {step === 'connecting' ? 'Connecting…' : 'Waiting for Bank Auth…'}
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                  {step === 'waiting'
                    ? 'Complete authentication in the pop-up window.\nDo not close this modal.'
                    : 'Exchanging tokens & loading accounts…'}
                </div>
                {step === 'waiting' && (
                  <button onClick={() => { popupRef.current?.close(); setStep('landing'); }}
                    style={{
                      marginTop: 24, padding: '8px 20px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer',
                    }}>
                    Cancel
                  </button>
                )}
              </motion.div>
            )}

            {/* ── SUCCESS ───────────────────────────────────────────────────── */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    style={{ marginBottom: 12 }}
                  >
                    <CheckCircle2 size={56} strokeWidth={2} color="#10b981" />
                  </motion.div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginBottom: 6 }}>
                    Bank Connected!
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {accounts.length} account{accounts.length !== 1 ? 's' : ''} linked · Transactions loading into your 3D city
                  </div>
                </div>

                <div style={{ maxHeight: 240, overflowY: 'auto', scrollbarWidth: 'thin', marginBottom: 20 }}>
                  {accounts.map(a => <AccountRow key={a.id} acc={a} />)}
                </div>

                <button onClick={onClose} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 2,
                }}>
                  → VIEW IN 3D CITY
                </button>
              </motion.div>
            )}

            {/* ── ERROR ────────────────────────────────────────────────────── */}
            {step === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 10 }}>
                  Connection Failed
                </div>
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 24,
                  fontSize: 12, color: '#fca5a5', lineHeight: 1.6,
                }}>
                  {errorMsg}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep('landing')} style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    border: '1px solid rgba(6,182,212,0.3)',
                    background: 'rgba(6,182,212,0.08)',
                    color: '#06b6d4', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}>↩ Try Again</button>
                  <button onClick={onClose} style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent',
                    color: '#475569', fontSize: 12, cursor: 'pointer',
                  }}>Close</button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
