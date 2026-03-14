/**
 * Aura Finance — My Page (설정) Modal
 * ─────────────────────────────────────────────────────────────────
 * 핀테크급 마이페이지: Profile, Connections, Security, Support, Danger Zone
 * 다크/사이버펑크/글래스모피즘 테마 유지
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  UserProfile,
  authUpdateProfile,
  changePassword,
  disconnectBank,
} from '../../api/client';
import { parseApiError } from '../../utils/parseApiError';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SEK', 'KRW', 'JPY', 'CAD', 'AUD'];

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.8)',
  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#94a3b8', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: '18px 20px',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.06)',
};

// ── Profile Section ───────────────────────────────────────────────────────────

function ProfileSection({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (p: Partial<UserProfile>) => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [income, setIncome] = useState(String(profile.monthly_income || 0));
  const [currency, setCurrency] = useState(profile.currency || 'USD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.display_name);
    setIncome(String(profile.monthly_income || 0));
    setCurrency(profile.currency || 'USD');
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await authUpdateProfile({
        display_name: name,
        monthly_income: parseFloat(income) || 0,
        currency,
      });
      onUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 2, marginBottom: 14 }}>PROFILE</div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Display Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Display name" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Email (read-only)</label>
        <input value={profile.email} readOnly style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Monthly Income</label>
          <input type="number" value={income} onChange={e => setIncome(e.target.value)} style={inputStyle} placeholder="0" min="0" step="100" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
        background: saving ? 'rgba(6,182,212,0.2)' : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', letterSpacing: 2,
      }}>
        {saving ? 'Saving…' : 'SAVE CHANGES'}
      </button>
    </div>
  );
}

// ── Connections Section ──────────────────────────────────────────────────────

function ConnectionsSection({
  bankConnected,
  lastSync,
  onSync,
  onDisconnect,
}: {
  bankConnected: boolean;
  lastSync: string | null;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your bank? Synced transactions will be kept.')) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 2, marginBottom: 14 }}>DATA CONNECTIONS</div>
      {bankConnected ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>Tink Demo Bank</span>
          </div>
          {lastSync && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Last sync: {lastSync}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSync} disabled={syncing} style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.1)',
              color: '#06b6d4', fontSize: 11, fontWeight: 600, cursor: syncing ? 'wait' : 'pointer', letterSpacing: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {syncing ? <><Loader2 size={14} strokeWidth={2} style={{ flexShrink: 0 }} />Syncing…</> : <><RefreshCw size={14} strokeWidth={2} style={{ flexShrink: 0 }} />SYNC NOW</>}
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting} style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: disconnecting ? 'wait' : 'pointer', letterSpacing: 1,
            }}>
              {disconnecting ? '…' : 'DISCONNECT'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#64748b' }}>No bank connected. Use Connect Bank to link your account.</div>
      )}
    </div>
  );
}

// ── Security Section ─────────────────────────────────────────────────────────

function SecuritySection({ onLogout }: { onLogout: () => void }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changing, setChanging] = useState(false);
  const [msg, setMsg] = useState('');

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setMsg('New passwords do not match.'); return; }
    if (newPw.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
    setChanging(true);
    setMsg('');
    try {
      await changePassword(currentPw, newPw);
      setMsg('Password updated.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: unknown) {
      setMsg(parseApiError(e));
    } finally {
      setChanging(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 2, marginBottom: 14 }}>SECURITY</div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Current Password</label>
        <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={inputStyle} placeholder="••••••••" maxLength={72} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>New Password</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} placeholder="••••••••" maxLength={72} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Confirm New Password</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputStyle} placeholder="••••••••" maxLength={72} />
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.includes('updated') ? '#10b981' : '#ef4444', marginBottom: 10 }}>{msg}</div>}
      <button onClick={handleChangePassword} disabled={changing} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
        background: changing ? 'rgba(6,182,212,0.2)' : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: changing ? 'wait' : 'pointer', letterSpacing: 2,
        marginBottom: 14,
      }}>
        {changing ? 'Changing…' : 'CHANGE PASSWORD'}
      </button>
      <button onClick={onLogout} style={{
        width: '100%', padding: '9px 0', borderRadius: 10,
        border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)',
        color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 2,
      }}>
        ⏻ LOG OUT ALL DEVICES
      </button>
    </div>
  );
}

// ── Support & Legal Section ───────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: 'How do I connect my bank?', a: 'Click the Connect Bank button and select a test bank from Tink Sandbox.' },
  { q: 'Where is my transaction data stored?', a: 'All data is stored in an encrypted database for the period specified in our terms of service.' },
  { q: 'How do I set up goals?', a: 'Add a new goal in the GOALS panel and choose a type (expense limit, savings, investment, etc.).' },
];

function SupportSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [inquiry, setInquiry] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendInquiry = () => {
    if (!inquiry.trim()) return;
    setSent(true);
    setInquiry('');
  };

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4', letterSpacing: 2, marginBottom: 14 }}>SUPPORT & LEGAL</div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>FAQ</div>
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.5)',
              color: '#e2e8f0', fontSize: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              {faq.q}
              <span style={{ fontSize: 14, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            <AnimatePresence>
              {openFaq === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', fontSize: 11, color: '#94a3b8', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}>
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>1:1 Support</label>
        <textarea value={inquiry} onChange={e => setInquiry(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Enter your inquiry" disabled={sent} />
        <button onClick={handleSendInquiry} disabled={sent || !inquiry.trim()} style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.3)',
          background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontSize: 11, cursor: sent ? 'default' : 'pointer', letterSpacing: 1,
        }}>
          {sent ? 'Sent' : 'SEND'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <a href="#" onClick={e => { e.preventDefault(); window.alert('Terms of Service content will be displayed here.'); }} style={{ fontSize: 12, color: '#06b6d4', textDecoration: 'none' }}>Terms of Service</a>
        <a href="#" onClick={e => { e.preventDefault(); window.alert('Privacy Policy content will be displayed here.'); }} style={{ fontSize: 12, color: '#06b6d4', textDecoration: 'none' }}>Privacy Policy</a>
      </div>
    </div>
  );
}

// ── Danger Zone Section ───────────────────────────────────────────────────────

function DangerZoneSection({ onExport, onDelete }: { onExport: () => void; onDelete: (password: string) => Promise<void> }) {
  const [exporting, setExporting] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (deleteConfirm.toUpperCase() !== 'DELETE' || !deletePw) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(deletePw);
      setDeleteModal(false);
      setDeleteConfirm('');
      setDeletePw('');
    } catch (e: unknown) {
      setDeleteError(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      ...sectionStyle,
      background: 'rgba(239,68,68,0.04)',
      border: '1px solid rgba(239,68,68,0.2)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: 2, marginBottom: 14 }}>DANGER ZONE</div>
      <button onClick={handleExport} disabled={exporting} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, marginBottom: 10,
        background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
        color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: exporting ? 'wait' : 'pointer', letterSpacing: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {exporting ? <><Loader2 size={14} strokeWidth={2} style={{ flexShrink: 0 }} />Preparing…</> : (
          <>
            <Download size={14} strokeWidth={2} style={{
              flexShrink: 0,
              color: '#06b6d4',
              filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.7)) drop-shadow(0 0 10px rgba(139,92,246,0.4))',
            }} />
            EXPORT MY DATA
          </>
        )}
      </button>
      <button onClick={() => setDeleteModal(true)} style={{
        width: '100%', padding: '10px 0', borderRadius: 10,
        border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.1)',
        color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <Trash2 size={14} strokeWidth={2} style={{
          flexShrink: 0,
          filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))',
        }} />
        DELETE ACCOUNT
      </button>

      <AnimatePresence>
        {deleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={e => { if (e.target === e.currentTarget) setDeleteModal(false); }}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              style={{
                background: 'rgba(8,14,30,0.98)', border: '2px solid rgba(239,68,68,0.4)',
                borderRadius: 16, padding: 24, maxWidth: 420, width: '100%',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginBottom: 12 }}>Delete Account</div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 16 }}>
                All financial data, goals, and bank connections will be permanently deleted. This cannot be undone.
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Type DELETE to confirm</label>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} style={inputStyle} placeholder="DELETE" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)} style={inputStyle} placeholder="••••••••" maxLength={72} />
              </div>
              {deleteError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{deleteError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDeleteSubmit} disabled={deleting || deleteConfirm.toUpperCase() !== 'DELETE' || !deletePw} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: deleting ? 'rgba(239,68,68,0.3)' : '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: deleting ? 'wait' : 'pointer',
                }}>
                  {deleting ? 'Deleting…' : 'DELETE'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface Props {
  open:           boolean;
  onClose:        () => void;
  profile:        UserProfile | null;
  onProfileUpdate: (p: UserProfile) => void;
  bankConnected:  boolean;
  lastSync:       string | null;
  onSyncBank:     () => void;
  onDisconnectBank: () => void;
  onExportData:   () => void;
  onDeleteAccount: (password: string) => Promise<void>;
  onLogout:       () => void;
}

export function MyPageModal({
  open,
  onClose,
  profile,
  onProfileUpdate,
  bankConnected,
  lastSync,
  onSyncBank,
  onDisconnectBank,
  onExportData,
  onDeleteAccount,
  onLogout,
}: Props) {
  if (!profile) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 200 }}
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: 'rgba(8,14,30,0.96)', backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(6,182,212,0.15)',
            display: 'flex', flexDirection: 'column', zIndex: 9998, fontFamily: "'Inter', sans-serif",
          }}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#06b6d4', letterSpacing: 3, marginBottom: 4 }}>MY PAGE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>Settings</div>
              </div>
              <button onClick={onClose} style={{
                width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#64748b', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <ProfileSection profile={profile} onUpdate={onProfileUpdate} />
            <ConnectionsSection bankConnected={bankConnected} lastSync={lastSync} onSync={onSyncBank} onDisconnect={onDisconnectBank} />
            <SecuritySection onLogout={onLogout} />
            <SupportSection />
            <DangerZoneSection onExport={onExportData} onDelete={onDeleteAccount} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
