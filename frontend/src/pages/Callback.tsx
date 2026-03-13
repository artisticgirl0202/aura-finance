/**
 * 🔄 Tink OAuth Callback Page
 *
 * 사용자가 은행 인증을 완료한 후 리다이렉트되는 페이지
 */

import { Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectBank } from '../api/banking';
import { useBankStore } from '../stores/bankStore';

function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setBankConnected, setJustConnected } = useBankStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Authenticating with bank...');

  // 중복 호출 방지를 위한 Ref
  const isCalledRef = useRef(false);

  const authCode = searchParams.get('code');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setMessage(`Authentication failed: ${errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => navigate('/', { replace: true }), 3000);
      return;
    }

    if (!authCode) {
      setStatus('error');
      setMessage('No authorization code received');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => navigate('/', { replace: true }), 3000);
      return;
    }

    // 이미 실행되었다면 즉시 중단 (Strict Mode 방지)
    if (isCalledRef.current) {
      console.log('⚠️ Duplicate call prevented');
      return;
    }
    isCalledRef.current = true;

    // URL에서 code 파라미터 즉시 제거 → 새로고침 시 재실행 방지
    window.history.replaceState({}, document.title, window.location.pathname);

    const processCallback = async () => {
      const isPopup = !!window.opener;

      try {
        setMessage('Connecting bank & fetching transactions...');
        console.log('🔐 Calling POST /banking/connect (unified flow)');

        // 통합 플로우: code → 백엔드에서 token 교환 + DB 저장 + 거래 조회 + AI 분류 + DB 저장
        const result = await connectBank(authCode);
        console.log('✅ Bank connected:', result);

        if (result.access_token) {
          localStorage.setItem('tink_access_token', result.access_token);
        }

        setStatus('success');
        setMessage(
          result.transaction_count > 0
            ? `Successfully connected! ${result.transaction_count} transactions saved.`
            : 'Bank connected. No transactions in the last 30 days.'
        );

        if (isPopup) {
          window.opener.postMessage(
            {
              type: 'TINK_CALLBACK',
              status: 'success',
              transaction_count: result.transaction_count,
              access_token: result.access_token,
            },
            window.location.origin
          );
          setTimeout(() => window.close(), 500);
        } else {
          setBankConnected(true);
          setJustConnected(true);
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error) {
        console.error('❌ Callback processing failed:', error);
        setStatus('error');
        setMessage((error as Error).message || 'Authentication failed');

        if (isPopup) {
          window.opener?.postMessage(
            { type: 'TINK_CALLBACK', status: 'error', error: (error as Error).message },
            window.location.origin
          );
          setTimeout(() => window.close(), 2000);
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
          setTimeout(() => navigate('/', { replace: true }), 5000);
        }
      }
    };

    processCallback();
  }, [authCode, errorParam, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#020617',
      color: '#e2e8f0',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Aura Finance 테마와 통일: 다크 + 네온 시안/퍼플 */}
      <div style={{
        background: 'rgba(8, 14, 30, 0.9)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        textAlign: 'center',
        boxShadow: '0 0 40px rgba(6, 182, 212, 0.12), 0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(6, 182, 212, 0.2)',
              borderTop: '4px solid #06b6d4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            }} />
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#06b6d4', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Banknote size={28} strokeWidth={2} style={{ flexShrink: 0 }} /> Authenticating with bank...
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={64} strokeWidth={2} color="#10b981" style={{ marginBottom: '20px' }} />
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#10b981', fontWeight: 700 }}>
              Success!
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>{message}</p>
            <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={64} strokeWidth={2} color="#ef4444" style={{ marginBottom: '20px' }} />
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#ef4444', fontWeight: 700 }}>
              Connection Failed
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#fca5a5' }}>{message}</p>
            <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Redirecting back...
            </p>
          </>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default Callback;
