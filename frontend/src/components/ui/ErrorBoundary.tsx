/**
 * ErrorBoundary — White Screen of Death 방지
 * ─────────────────────────────────────────────────────────────────
 * 하위 컴포넌트에서 에러 발생 시 전체 앱 대신 폴백 UI 표시
 */

import { AlertTriangle } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            padding: 24,
            background: 'rgba(8,14,30,0.95)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <AlertTriangle size={40} strokeWidth={2} color="#f59e0b" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 320 }}>
            {this.state.error?.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
