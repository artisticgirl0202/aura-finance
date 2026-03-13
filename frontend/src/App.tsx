import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Eye, Search, Target } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteAccount,
  disconnectBank,
  District,
  exportUserData,
  fetchDistricts,
  fetchTransactionHistory,
  healthCheck,
  syncBankData,
} from './api/client';
import { getDistrictColor } from './constants/districtColors';
import { CityScene } from './components/3d/CityScene';
import { AIAdvisorPanel } from './components/ui/AIAdvisorPanel';
import { AIInsightToast, type UnifiedInsight } from './components/ui/AIInsightToast';
import { BankConnectModal } from './components/ui/BankConnectModal';
import { BankSyncOverlay } from './components/ui/BankSyncOverlay';
import { BankSyncToast } from './components/ui/BankSyncToast';
import { BudgetPanel } from './components/ui/BudgetPanel';
import { ActiveTab, ControlPanel } from './components/ui/ControlPanel';
import { DashboardOverlay } from './components/ui/DashboardOverlay';
import { DistrictDetailPanel } from './components/ui/DistrictDetailPanel';
import { GoalsDashboard } from './components/ui/GoalsDashboard';
import { MyPageModal } from './components/ui/MyPageModal';
import { PanelBackdrop } from './components/ui/PanelBackdrop';
import { useAuth } from './contexts/AuthContext';
import { useAnalyticsInsights } from './hooks/useAnalyticsInsights';
import { useAnalyticsOverview } from './hooks/useAnalyticsOverview';
import { useBudget } from './hooks/useBudget';
import { useGoalAchievements } from './hooks/useGoalAchievements';
import { useSimulationMode } from './hooks/useSimulationMode';
import { useTransactionClassifier } from './hooks/useTransactionClassifier';
import { useBankStore } from './stores/bankStore';
import { usePanelStore } from './stores/panelStore';
import { useTransactionStore } from './stores/transactionStore';

/**
 * Aura Finance - AI 기반 금융 시각화 앱
 * 메인 애플리케이션 컴포넌트
 */
function App() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [inputDescription, setInputDescription] = useState('');
  const [inputAmount, setInputAmount] = useState('100');
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('expense');
  const [searchQuery, setSearchQuery] = useState('');

  const { activePanel, openPanel, closePanel } = usePanelStore();
  const { isBankConnected: bankConnected, setBankConnected, setJustConnected, setHasLoadedDemoData, justConnected, syncFromStorage } = useBankStore();
  const { getCached, setBankTransactions } = useTransactionStore();

  // 연동 직후 로딩/축하 UI (새로고침 시 절대 노출 안 함)
  const [bankSyncOverlay, setBankSyncOverlay] = useState(false);
  const [bankSyncToastCount, setBankSyncToastCount] = useState(0);
  const [bankSyncToastMessage, setBankSyncToastMessage] = useState<string | null>(null);
  const [guestReadOnlyInsight, setGuestReadOnlyInsight] = useState<UnifiedInsight | null>(null);
  const [simulationToast, setSimulationToast] = useState<UnifiedInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedDistrict(null); // 탭 클릭 시 건물 상세 종료 → 전체 대시보드로 복귀
  }, []);

  const showBudgetPanel   = activePanel === 'budget';
  const showGoalsDashboard = activePanel === 'goals';
  const showAIAdvisor     = activePanel === 'aiAdvisor';
  const showBankConnect   = activePanel === 'bankConnect';
  const showMyPage        = activePanel === 'settings';

  // 🔐 Auth
  const { user, isGuest, logout, updateProfile } = useAuth();

  // transactions must be declared before useBudget which depends on it
  const {
    transactions,
    loading,
    error,
    classifyTransaction,
    addPreClassifiedTransaction,
    clearTransactions,
    setBankTransactionsBatch,
  } = useTransactionClassifier();

  // Budget state + AI insights (placed after transactions)
  const {
    budgetSettings,
    budgetRatios,
    categorySpend,
    incomeTotal,
    activeInsights,
    saveBudget,
    dismissInsight,
  } = useBudget(transactions);

  // Goal Tracker 달성 목표 → 3D 축하 이펙트 (수입/투자/저축/순자산 등)
  const { achievedGoals, clearAchievedGoal } = useGoalAchievements(incomeTotal);

  // Analytics overview (M4/M6 AI + Phase 2 chart-ready stats) — 3D district risk, AI Advisor, Stats tab
  const { overview, districtRiskRatios, loading: analyticsLoading, refresh: refreshAnalytics } = useAnalyticsOverview(true);

  // Phase 3: AI Smart Alerts
  const { insights: analyticsInsights, dismiss: dismissAnalyticsInsight } = useAnalyticsInsights(true);

  const showGuestReadOnlyToast = useCallback(() => {
    setGuestReadOnlyInsight({
      id: 'guest-read-only',
      type: 'info',
      title: 'Read-only in Guest Mode',
      message: 'Modifications are disabled. Sign up or log in to save changes.',
      icon: '🔒',
    });
  }, []);

  const handleExitGuest = useCallback(() => {
    logout();
    closePanel();
  }, [logout, closePanel]);

  // 통합 알림 (예산 + AI + 게스트 읽기전용) — 우측 하단 단일 위치
  const unifiedInsights: UnifiedInsight[] = useMemo(() => {
    const budget: UnifiedInsight[] = activeInsights.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      message: i.message,
    }));
    const analytics: UnifiedInsight[] = analyticsInsights.map((a) => ({
      id: a.id,
      type: (a.type === 'praise' ? 'success' : a.type) as UnifiedInsight['type'],
      title: a.title,
      message: a.message,
      icon: a.icon,
    }));
    const guest: UnifiedInsight[] = guestReadOnlyInsight ? [guestReadOnlyInsight] : [];
    const sim: UnifiedInsight[] = simulationToast ? [simulationToast] : [];
    return [...analytics, ...budget, ...guest, ...sim];
  }, [activeInsights, analyticsInsights, guestReadOnlyInsight, simulationToast]);

  const handleDismissInsight = useCallback((id: string) => {
    if (id === 'guest-read-only') setGuestReadOnlyInsight(null);
    if (id.startsWith('simulation-')) setSimulationToast(null);
    dismissInsight(id);
    dismissAnalyticsInsight(id);
  }, [dismissInsight, dismissAnalyticsInsight]);
  // Merge budget ratios with trend risk: high exceed prob → force red tint
  const effectiveBudgetRatios = { ...budgetRatios };
  Object.entries(districtRiskRatios).forEach(([district, risk]) => {
    const current = effectiveBudgetRatios[district] ?? 0;
    if (risk > current) effectiveBudgetRatios[district] = risk;
  });

  // 🎬 실시간 시뮬레이션 모드
  const simulation = useSimulationMode({
    enabled: simulationEnabled,
    onTransaction: (transaction) => {
      // WS already sends full classification — skip double API call
      addPreClassifiedTransaction(
        transaction.description,
        transaction.amount,
        transaction.currency,
        transaction.type || 'expense',
        transaction.classification,
      );
    },
  });

  // Idempotency: 같은 "연결 세션"에서 중복 호출 방지
  const bankTxLoadedRef = useRef(false);

  /**
   * DB에서 은행 거래 로드 (Stale-while-revalidate)
   * @param isSilent - true: 새로고침 시 조용히 (로딩/토스트 없음), false: 연동 직후 로딩+축하
   * @param includeAllSources - true: manual+tink 등 모든 소스 포함 (분류 후 동기화용), false: tink만
   */
  const loadTransactionsFromDb = useCallback(async (isSilent = true, includeAllSources = false) => {
    const cached = getCached();

    // 1. 캐시 즉시 표시 (분류 직후 Refetch 시에는 스킵 — 현재 상태가 더 최신)
    if (cached.length > 0 && !includeAllSources) {
      setBankTransactionsBatch(cached);
    }

    try {
      if (!isSilent) setBankSyncOverlay(true);

      const params: { limit: number; offset: number; source?: string } = { limit: 200, offset: 0 };
      if (!includeAllSources) params.source = 'tink';
      const res = await fetchTransactionHistory(params);
      const txs = res.data ?? [];

      // 2. DB 응답으로 UI 갱신 + 캐시 저장 (tx_timestamp 포함 — DistrictDetailPanel 표시용)
      const formatted = txs.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        currency: t.currency || 'USD',
        type: t.type || 'expense',
        district: t.district,
        confidence: t.confidence ?? 0,
        reason: t.reason ?? null,
        icon: t.icon ?? 'circle',
        color: t.color ?? '#6b7280',
        tx_timestamp: t.tx_timestamp ?? t.created_at ?? null,
      }));
      setBankTransactions(formatted);
      setBankTransactionsBatch(formatted);
      if (txs.length > 0) setHasLoadedDemoData(true);

      if (!isSilent) {
        setBankSyncOverlay(false);
        setJustConnected(false);
        if (txs.length > 0) setBankSyncToastCount(txs.length);
      }
      if (!isSilent && txs.length > 0) {
        console.log(`✅ ${txs.length} Tink transactions loaded to 3D`);
      }
    } catch (err) {
      if (!isSilent) {
        setBankSyncOverlay(false);
        setJustConnected(false);
      }
      console.error('Failed to load bank transactions from DB:', err);
    }
  }, [getCached, setBankTransactions, setBankTransactionsBatch, setJustConnected, setHasLoadedDemoData]);

  // 🏦 초기 마운트: persisted bank state와 localStorage 동기화
  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  // bankConnected가 false로 바뀔 때 (연동 해제) ref 리셋
  useEffect(() => {
    if (!bankConnected) bankTxLoadedRef.current = false;
  }, [bankConnected]);

  // 🏦 은행 연동 시: 캐시 즉시 표시 → DB만 가볍게 GET (Tink 중복 호출 방지)
  useEffect(() => {
    if (!bankConnected || bankTxLoadedRef.current) return;
    bankTxLoadedRef.current = true;
    // hasLoadedDemoData: 이미 DB에 데이터 있음 → Tink 재호출 없이 DB에서만 로드
    // justConnected: 방금 연동 완료 → 로딩 UI + 축하 알림 (isSilent=false)
    // 그 외(새로고침): 조용히 캐시 표시 후 DB 재검증 (isSilent=true)
    loadTransactionsFromDb(!justConnected);
  }, [bankConnected, justConnected, loadTransactionsFromDb]);

  // 🎭 게스트 모드: Mock 거래 로드 (실제 DB 조회 없이 풍부한 데모 데이터)
  useEffect(() => {
    if (!isGuest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTransactionHistory({ limit: 50, offset: 0 });
        const txs = (res.data ?? res) as any[];
        if (cancelled || !txs?.length) return;
        const formatted = txs.map((t, i) => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          currency: t.currency || 'USD',
          type: t.type || 'expense',
          district: t.district,
          confidence: t.confidence ?? 0,
          reason: t.reason ?? null,
          icon: t.icon ?? 'circle',
          color: t.color ?? '#6b7280',
          tx_timestamp: t.tx_timestamp ?? t.created_at ?? null,
        }));
        setBankTransactionsBatch(formatted);
      } catch {
        /* guest mock may fail if backend not ready */
      }
    })();
    return () => { cancelled = true; };
  }, [isGuest, setBankTransactionsBatch]);

  // 앱 초기화 - 구역 정보 불러오기
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. 서버 헬스체크
        const health = await healthCheck();
        console.log('🏥 Backend Health:', health);

        // 2. 구역 정보 로드
        const districtsData = await fetchDistricts();
        setDistricts(districtsData.filter((d: District) => d.name !== 'Unknown'));
        console.log('🏙️ Districts loaded:', districtsData.length);

      } catch (err) {
        console.error('❌ Failed to initialize app:', err);
        // 사용자에게 에러 표시 (선택사항)
        alert('Cannot connect to backend. Check that the API server is running and VITE_API_URL is set correctly.');
      }
    };

    initializeApp();
  }, []);

  // 시뮬레이션 상태 변경 디버깅
  useEffect(() => {
    console.log(`🎬 Simulation state changed: ${simulationEnabled}`);
  }, [simulationEnabled]);

  // 거래 분류 실행
  const handleClassify = async () => {
    if (!inputDescription.trim()) {
        alert('Please enter merchant name');
      return;
    }
    if (isGuest) {
      showGuestReadOnlyToast();
      return;
    }
    const result = await classifyTransaction(
      inputDescription,
      parseFloat(inputAmount) || 0
    );
    if (result) {
      refreshAnalytics();
      loadTransactionsFromDb(true, true);
    }
  };

  // 샘플 거래 테스트
  const testSamples = [
    { description: 'STARBUCKS SEOUL', amount: 5.5 },
    { description: 'AWS*USAGE', amount: 45.0 },
    { description: 'TFL.GOV.UK LONDON', amount: 3.2 },
    { description: 'NETFLIX.COM', amount: 15.99 },
    { description: 'SEOUL METRO', amount: 1.5 },
    { description: 'MCDONALDS', amount: 8.0 },
  ];

  const handleTestSamples = async () => {
    if (isGuest) {
      showGuestReadOnlyToast();
      return;
    }
    setIsGenerating(true);
    setSimulationToast({
      id: 'simulation-init',
      type: 'info',
      title: 'Initializing AI Transaction Simulation...',
      message: 'Feeding sample data to the AI classifier. Watch the 3D city populate in real time.',
      icon: '⚡',
    });
    try {
      for (const sample of testSamples) {
        await classifyTransaction(sample.description, sample.amount);
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 간격
      }
      setSimulationToast({
        id: 'simulation-complete',
        type: 'success',
        title: 'Simulation Complete',
        message: 'AI categorized new transactions. Check the 3D city view.',
        icon: '🌟',
      });
      refreshAnalytics();
      loadTransactionsFromDb(true, true);
    } catch (err) {
      setSimulationToast({
        id: 'simulation-error',
        type: 'danger',
        title: 'Simulation Failed',
        message: err instanceof Error ? err.message : 'An error occurred.',
        icon: '🚨',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 🏦 은행 연결 핸들러 — exclusive panel open
  const handleConnectBank = () => openPanel('bankConnect');

  const showRightPanel = transactions.length > 0 || selectedDistrict !== null || searchQuery.trim().length > 0;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden', background: '#0a0e27' }}>

      {/* ── LEFT: 3D City Scene ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        <CityScene
          transactions={transactions}
          districts={districts}
          onDistrictSelect={setSelectedDistrict}
          selectedDistrict={selectedDistrict}
          budgetRatios={effectiveBudgetRatios}
          activeTab={activeTab}
          achievedGoals={achievedGoals}
          onGoalCelebrated={clearAchievedGoal}
          searchQuery={searchQuery}
        />

        {/* ── User bar — top-right of 3D scene ── */}
        <div style={{
          position: 'absolute', top: 20, right: 20, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* AI Advisor button */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => openPanel('aiAdvisor')}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid rgba(139,92,246,0.35)',
              background: 'rgba(139,92,246,0.12)',
              color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 1,
              backdropFilter: 'blur(12px)',
            }}
          >
            <Bot size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> AI ADVISOR
          </motion.button>
          {/* Goals button */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => openPanel('goals')}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid rgba(16,185,129,0.35)',
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, letterSpacing: 1,
              backdropFilter: 'blur(12px)',
            }}
          >
            <Target size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> GOALS
          </motion.button>

          {/* User chip — 클릭 시 마이페이지 모달 */}
          {user ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(8,14,30,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10,
              padding: '6px 10px 6px 12px',
            }}>
              <button
                onClick={() => openPanel('settings')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, color: 'inherit',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>
                  {user.display_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.display_name}
                </span>
              </button>
              <button onClick={logout} style={{
                background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '0 2px',
              }} title="Logout">⏻</button>
            </div>
          ) : isGuest ? (
            <div
              title="Guest Mode — Sign up or log in in the Control Panel below"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(6,182,212,0.35)',
                background: 'rgba(6,182,212,0.08)',
                backdropFilter: 'blur(12px)',
                color: '#06b6d4',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              <Eye size={16} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.9 }} />
              Guest Mode
            </div>
          ) : null}
        </div>

        {/* Control Panel — absolute within left column */}
        <ControlPanel
          bankConnected={bankConnected}
          onConnectBank={handleConnectBank}
          isGuest={isGuest}
          onExitGuest={handleExitGuest}
          onOpenBudget={() => openPanel('budget')}
          simulationEnabled={simulationEnabled}
          simulationConnected={simulation.isConnected}
          simulationError={simulation.error}
          onToggleSimulation={() => {
            const newState = !simulationEnabled;
            console.log(`🎬 Simulation button clicked: ${simulationEnabled} → ${newState}`);
            setSimulationEnabled(newState);
          }}
          inputDescription={inputDescription}
          inputAmount={inputAmount}
          loading={loading}
          error={error}
          transactionCount={transactions.length}
          onInputDescriptionChange={setInputDescription}
          onInputAmountChange={setInputAmount}
          onClassify={handleClassify}
          onClear={clearTransactions}
          onTestSamples={handleTestSamples}
          isGenerating={isGenerating}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* District legend — bottom-left of 3D scene */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(10, 10, 30, 0.8)',
            backdropFilter: 'blur(16px)',
            padding: '12px 16px',
            borderRadius: '14px',
            color: 'white',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            maxWidth: '220px',
          }}
        >
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            fontFamily: 'var(--font-display)',
            color: '#06b6d4',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px',
          }}>
            Districts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {districts.map((district) => (
              <div key={district.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: getDistrictColor(district.name),
                  boxShadow: `0 0 6px ${getDistrictColor(district.name)}`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-body)' }}>
                  {district.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI 인사이트 알림 — 우측 하단 (대시보드 시야 방해 최소화) */}
      <AIInsightToast insights={unifiedInsights} onDismiss={handleDismissInsight} />

      {/* 은행 연동 직후 로딩 오버레이 (새로고침 시 미표시) */}
      <BankSyncOverlay visible={bankSyncOverlay} />

      {/* 연동 완료 축하 토스트 */}
      {bankSyncToastCount > 0 && (
        <BankSyncToast
          count={bankSyncToastCount}
          message={bankSyncToastMessage ?? undefined}
          onDismiss={() => {
            setBankSyncToastCount(0);
            setBankSyncToastMessage(null);
          }}
        />
      )}

      {/* Backdrop — 블러 오버레이, 패널 외부 클릭 시 닫기 */}
      <PanelBackdrop
        visible={activePanel !== null}
        onClick={closePanel}
      />

      {/* Budget Settings Modal */}
      <BudgetPanel
        isOpen={showBudgetPanel}
        onClose={closePanel}
        districts={districts.map((d) => ({ name: d.name, color: getDistrictColor(d.name) }))}
        currentSettings={budgetSettings}
        onSave={saveBudget}
        categorySpend={categorySpend}
      />

      {/* Goals Dashboard (sliding right panel) */}
      <GoalsDashboard
        open={showGoalsDashboard}
        onClose={closePanel}
        currency={user?.currency ?? 'USD'}
        isGuest={isGuest}
        onGuestReadOnly={showGuestReadOnlyToast}
      />

      {/* AI Advisor Panel (M6 advice + SHAP) */}
      <AIAdvisorPanel
        open={showAIAdvisor}
        onClose={closePanel}
        advice={overview?.ai_advice ?? []}
        riskScore={overview?.risk_score ?? 0}
        loading={analyticsLoading}
      />

      {/* My Page (설정) Modal */}
      {user && (
        <MyPageModal
          open={showMyPage}
          onClose={closePanel}
          profile={user}
          onProfileUpdate={updateProfile}
          bankConnected={bankConnected}
          lastSync={null}
          onSyncBank={async () => {
            setBankSyncOverlay(true);
            try {
              const { synced_count } = await syncBankData();
              bankTxLoadedRef.current = false;
              setBankSyncToastCount(synced_count > 0 ? synced_count : 1);
              setBankSyncToastMessage('Bank data synced successfully!');
              await loadTransactionsFromDb(false);
            } catch {
              setBankSyncOverlay(false);
              setBankSyncToastMessage(null);
            } finally {
              setBankSyncOverlay(false);
            }
          }}
          onDisconnectBank={async () => {
            try { await disconnectBank(); } catch { localStorage.removeItem('tink_access_token'); }
            setBankConnected(false);
            setHasLoadedDemoData(false);
            bankTxLoadedRef.current = false;
            useTransactionStore.getState().clearBankTransactions();
            clearTransactions();
          }}
          onExportData={async () => {
            try {
              const blob = await exportUserData();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `aura_finance_export_${new Date().toISOString().slice(0,10)}.json`;
              a.click(); URL.revokeObjectURL(url);
            } catch {
              const data = { exported_at: new Date().toISOString(), transactions };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `aura_finance_export_${new Date().toISOString().slice(0,10)}.json`;
              a.click(); URL.revokeObjectURL(url);
            }
          }}
          onDeleteAccount={async (password) => {
            await deleteAccount(password);
            logout();
          }}
          onLogout={() => { logout(); closePanel(); }}
        />
      )}

      {/* Bank Connect Modal */}
      {showBankConnect && (
        <BankConnectModal
          onClose={closePanel}
          onConnected={() => {
            setJustConnected(true);
            setBankConnected(true);
            closePanel();
            bankTxLoadedRef.current = false;
          }}
        />
      )}

      {/* ── RIGHT: Persistent sidebar (Dashboard ↔ District Detail) ── */}
      <AnimatePresence>
        {showRightPanel && (
          <motion.aside
            key="right-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 390, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            style={{
              flexShrink: 0,
              height: '100vh',
              overflow: 'hidden',
              background: 'rgba(8, 10, 28, 0.96)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(6, 182, 212, 0.2)',
              boxShadow: '-4px 0 30px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Neon top accent line */}
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent)',
              flexShrink: 0,
            }} />

            {/* Tab indicator bar */}
            <div style={{ display: 'flex', padding: '12px 16px 0', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <div style={{
                fontSize: '11px', fontFamily: 'var(--font-display)',
                color: (selectedDistrict || searchQuery) ? '#94a3b8' : '#06b6d4',
                textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '20px',
                background: (selectedDistrict || searchQuery) ? 'transparent' : 'rgba(6,182,212,0.12)',
                border: `1px solid ${(selectedDistrict || searchQuery) ? 'transparent' : 'rgba(6,182,212,0.3)'}`,
                transition: 'all 0.3s', cursor: (selectedDistrict || searchQuery) ? 'pointer' : 'default',
              }}
                onClick={() => { setSelectedDistrict(null); setSearchQuery(''); }}
              >
                Dashboard
              </div>
              {selectedDistrict && !searchQuery && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  style={{
                    fontSize: '11px', fontFamily: 'var(--font-display)',
                    color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600,
                    padding: '4px 10px', borderRadius: '20px',
                    background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
                  }}
                >
                  {selectedDistrict}
                </motion.div>
              )}
              {searchQuery && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  style={{
                    fontSize: '11px', fontFamily: 'var(--font-display)',
                    color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600,
                    padding: '4px 10px', borderRadius: '20px',
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Search size={12} strokeWidth={2} style={{ marginRight: 4, flexShrink: 0, opacity: 0.9 }} />"{searchQuery}"
                </motion.div>
              )}
            </div>

            {/* Panel content — padding-right로 스크롤바가 보더에서 이격 */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', paddingRight: 4 }}>
              <AnimatePresence mode="wait">
                {selectedDistrict ? (
                  <motion.div
                    key={`detail-${selectedDistrict}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.25 }}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    <DistrictDetailPanel
                      selectedDistrict={selectedDistrict}
                      transactions={transactions}
                      onClose={() => setSelectedDistrict(null)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.25 }}
                    style={{ position: 'absolute', inset: 0 }}
                  >
                    <DashboardOverlay
                      transactions={transactions}
                      budgetRatios={budgetRatios}
                      budgetSettings={budgetSettings}
                      categorySpend={categorySpend}
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery('')}
                      analyticsOverview={overview}
                      analyticsLoading={analyticsLoading}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
