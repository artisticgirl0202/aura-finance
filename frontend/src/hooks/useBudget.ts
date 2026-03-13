/**
 * useBudget — Budget state + income/investment goals + rule-based AI insights.
 *
 * Extended with:
 *  - incomeGoal: monthly income target
 *  - investmentGoal: monthly investment target
 *  - achievedGoals: tracks newly-achieved goals for celebration effect
 *  - Enhanced insight engine (income/investment patterns + diversification advice)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface BudgetSettings {
  total: number;                        // monthly total expense limit ($)
  categories: Record<string, number>;   // district name → monthly expense limit ($)
  incomeGoal: number;                   // monthly income target ($)
  investmentGoal: number;               // monthly investment target ($)
}

export type InsightType = 'info' | 'warning' | 'danger' | 'success';

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  district?: string;
}

// ── Rule engine ───────────────────────────────────────────────────────────────

function generateInsights(
  transactions: any[],
  budget: BudgetSettings,
  categorySpend: Record<string, number>,
  incomeTotal: number,
  investmentTotal: number,
): Insight[] {
  const results: Insight[] = [];

  // ── 1. Per-category expense budget ────────────────────────────────────────
  Object.entries(budget.categories).forEach(([district, limit]) => {
    if (limit <= 0) return;
    const spent = categorySpend[district] || 0;
    const ratio = spent / limit;

    if (ratio >= 1.0) {
      results.push({
        id: `exceeded-${district}`,
        type: 'danger',
        title: 'Budget Exceeded!',
        message: `${district} spending ($${spent.toFixed(0)}) exceeds monthly budget ($${limit.toFixed(0)}) by ${((ratio - 1) * 100).toFixed(0)}%.`,
        district,
      });
    } else if (ratio >= 0.8) {
      results.push({
        id: `warning-${district}-${Math.floor(ratio * 10)}`,
        type: 'warning',
        title: 'Budget Warning',
        message: `${district} spending at ${(ratio * 100).toFixed(0)}% of budget ($${spent.toFixed(0)} / $${limit.toFixed(0)}).`,
        district,
      });
    }
  });

  // ── 2. Total monthly expense budget ───────────────────────────────────────
  if (budget.total > 0) {
    const totalSpent = Object.values(categorySpend).reduce((a, b) => a + b, 0);
    const totalRatio = totalSpent / budget.total;
    if (totalRatio >= 1.0) {
      results.push({
        id: `total-exceeded-${Math.floor(totalRatio * 10)}`,
        type: 'danger',
        title: 'Total Budget Exceeded!',
        message: `This month's total spending $${totalSpent.toFixed(0)} exceeds your budget of $${budget.total.toFixed(0)}.`,
      });
    } else if (totalRatio >= 0.9) {
      results.push({
        id: `total-warning-${Math.floor(totalRatio * 10)}`,
        type: 'warning',
        title: 'Budget at 90%',
        message: `This month's spending is at ${(totalRatio * 100).toFixed(0)}% of budget. Consider cutting back.`,
      });
    }
  }

  // ── 3. Income goal progress ───────────────────────────────────────────────
  if (budget.incomeGoal > 0) {
    const incomeRatio = incomeTotal / budget.incomeGoal;
    if (incomeRatio >= 1.0) {
      results.push({
        id: `income-goal-achieved-${Math.floor(incomeTotal / 100)}`,
        type: 'success',
        title: '🎉 Income Goal Achieved!',
        message: `This month's income $${incomeTotal.toFixed(0)} hit your target of $${budget.incomeGoal.toFixed(0)}!`,
      });
    } else if (incomeRatio >= 0.8) {
      results.push({
        id: `income-close-${Math.floor(incomeRatio * 10)}`,
        type: 'info',
        title: 'Income Goal 80% Reached',
        message: `$${(budget.incomeGoal - incomeTotal).toFixed(0)} to go. You're almost there!`,
      });
    }
  }

  // ── 4. Investment goal progress ───────────────────────────────────────────
  if (budget.investmentGoal > 0) {
    const investRatio = investmentTotal / budget.investmentGoal;
    if (investRatio >= 1.0) {
      results.push({
        id: `invest-goal-achieved-${Math.floor(investmentTotal / 100)}`,
        type: 'success',
        title: '🎉 Investment Goal Achieved!',
        message: `This month's investment $${investmentTotal.toFixed(0)} hit your target of $${budget.investmentGoal.toFixed(0)}!`,
      });
    } else if (investRatio >= 0.7) {
      results.push({
        id: `invest-close-${Math.floor(investRatio * 10)}`,
        type: 'info',
        title: 'Investment Goal in Progress',
        message: `Investment goal at ${(investRatio * 100).toFixed(0)}%. $${(budget.investmentGoal - investmentTotal).toFixed(0)} to go.`,
      });
    }
  }

  // ── 5. Investment diversification (crypto concentration) ──────────────────
  const investTxs = transactions.filter((t: any) => t.type === 'investment');
  if (investTxs.length >= 4) {
    const cryptoCount = investTxs.filter((t: any) =>
      t.district === 'Crypto' || t.classification?.district === 'Crypto',
    ).length;
    if (cryptoCount / investTxs.length > 0.6) {
      results.push({
        id: `crypto-concentration-${cryptoCount}`,
        type: 'warning',
        title: 'Portfolio Concentration Warning',
        message: `${Math.round((cryptoCount / investTxs.length) * 100)}% of investments are in crypto. Consider diversifying.`,
      });
    }
  }

  // ── 6. Top-spending insight (no budget needed) ────────────────────────────
  const sorted = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] > 50 && results.length === 0) {
    results.push({
      id: `top-${sorted[0][0]}-${Math.floor(sorted[0][1] / 50)}`,
      type: 'info',
      title: 'Spending Analysis',
      message: `${sorted[0][0]} is your top spending category this month ($${sorted[0][1].toFixed(0)}).`,
      district: sorted[0][0],
    });
  }

  // ── 7. Consecutive same-category transactions (last 3) ────────────────────
  if (transactions.length >= 3) {
    const last3 = transactions.slice(-3).map(
      (t: any) => t.classification?.district || t.district,
    );
    if (last3[0] && last3[0] === last3[1] && last3[1] === last3[2]) {
      const cat = last3[0];
      results.push({
        id: `consecutive-${cat}-${transactions.length}`,
        type: 'info',
        title: 'Spending Pattern Detected',
        message: `3 consecutive ${cat} transactions. Review your spending.`,
        district: cat,
      });
    }
  }

  // ── 8. Spending velocity (many transactions in short time) ────────────────
  const recentExpenses = transactions.filter((t: any) =>
    (!t.type || t.type === 'expense') &&
    Date.now() - (t.timestamp || 0) < 8 * 60 * 1000, // last 8 minutes
  );
  if (recentExpenses.length >= 5) {
    results.push({
      id: `spending-velocity-${recentExpenses.length}`,
      type: 'warning',
      title: 'Rapid Spending Detected',
      message: `${recentExpenses.length} expenses in the last 8 minutes. Watch out for impulse spending!`,
    });
  }

  // ── 9. Income-to-expense ratio warning ───────────────────────────────────
  const totalExpenses = Object.values(categorySpend).reduce((a, b) => a + b, 0);
  if (incomeTotal > 0 && totalExpenses > 0) {
    const ratio = totalExpenses / incomeTotal;
    if (ratio >= 0.9 && results.every((r) => r.id !== `ie-danger-${Math.floor(ratio * 10)}`)) {
      results.push({
        id: `ie-danger-${Math.floor(ratio * 10)}`,
        type: 'danger',
        title: 'Expense/Income Ratio Risk',
        message: `Spending is ${(ratio * 100).toFixed(0)}% of income. Little room for savings.`,
      });
    } else if (ratio >= 0.7 && ratio < 0.9 && results.every((r) => r.id !== `ie-warn-${Math.floor(ratio * 10)}`)) {
      results.push({
        id: `ie-warn-${Math.floor(ratio * 10)}`,
        type: 'warning',
        title: 'High Spending Ratio',
        message: `Spending is ${(ratio * 100).toFixed(0)}% of income. Consider improving your savings rate.`,
      });
    }
  }

  // ── 10. Stock concentration warning ──────────────────────────────────────
  const investTxs2 = transactions.filter((t: any) => t.type === 'investment');
  if (investTxs2.length >= 3) {
    const stockCount = investTxs2.filter((t: any) =>
      t.district === 'Stocks' || t.classification?.district === 'Stocks',
    ).length;
    if (stockCount / investTxs2.length > 0.65) {
      results.push({
        id: `stock-concentration-${stockCount}`,
        type: 'warning',
        title: 'Stock Concentration Warning',
        message: `${Math.round((stockCount / investTxs2.length) * 100)}% of investments are in stocks. Consider diversifying into bonds, ETF, or real estate.`,
      });
    }
  }

  // ── 11. Single-merchant concentration (e.g. same place 3+ times) ─────────
  if (transactions.length >= 3) {
    const merchantCounts: Record<string, number> = {};
    transactions
      .filter((t: any) => !t.type || t.type === 'expense')
      .slice(-15)
      .forEach((t: any) => {
        const desc = (t.description || '').slice(0, 20).toLowerCase().trim();
        if (desc) merchantCounts[desc] = (merchantCounts[desc] || 0) + 1;
      });
    const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0];
    if (topMerchant && topMerchant[1] >= 3) {
      results.push({
        id: `merchant-${topMerchant[0]}-${topMerchant[1]}`,
        type: 'info',
        title: 'Recurring Spending Detected',
        message: `"${topMerchant[0]}" charged ${topMerchant[1]} times recently. Check for subscriptions or recurring charges.`,
      });
    }
  }

  return results;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBudget(transactions: any[]) {
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(() => {
    try {
      const saved = localStorage.getItem('aura_budget');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        total: 0,
        categories: {},
        incomeGoal: 0,
        investmentGoal: 0,
        ...parsed,
      };
    } catch {
      return { total: 0, categories: {}, incomeGoal: 0, investmentGoal: 0 };
    }
  });

  const [activeInsights, setActiveInsights] = useState<Insight[]>([]);
  const dismissedRef    = useRef<Set<string>>(new Set());
  const prevTxCountRef  = useRef(0);

  // ── Expense spend per district (only expense transactions) ───────────────
  const categorySpend = useMemo(() => {
    const spend: Record<string, number> = {};
    transactions
      .filter((tx: any) => !tx.type || tx.type === 'expense')
      .forEach((tx: any) => {
        const district = tx.classification?.district || tx.district || 'Unknown';
        spend[district] = (spend[district] || 0) + (tx.amount || 0);
      });
    return spend;
  }, [transactions]);

  // ── Income / Investment totals ────────────────────────────────────────────
  const incomeTotal = useMemo(
    () => transactions
      .filter((t: any) => t.type === 'income')
      .reduce((s: number, t: any) => s + (t.amount || 0), 0),
    [transactions],
  );

  const investmentTotal = useMemo(
    () => transactions
      .filter((t: any) => t.type === 'investment')
      .reduce((s: number, t: any) => s + (t.amount || 0), 0),
    [transactions],
  );

  // ── Budget ratio per district ─────────────────────────────────────────────
  const budgetRatios = useMemo(() => {
    const ratios: Record<string, number> = {};
    Object.entries(budgetSettings.categories).forEach(([district, limit]) => {
      if (limit > 0) ratios[district] = (categorySpend[district] || 0) / limit;
    });
    return ratios;
  }, [budgetSettings.categories, categorySpend]);

  // ── Income / Investment goal ratios ──────────────────────────────────────
  const incomeGoalRatio = budgetSettings.incomeGoal > 0
    ? incomeTotal / budgetSettings.incomeGoal
    : 0;

  const investGoalRatio = budgetSettings.investmentGoal > 0
    ? investmentTotal / budgetSettings.investmentGoal
    : 0;

  // ※ 축하 이펙트(파티클/폭죽)는 Goal Tracker 패널의 목표 달성 시 useGoalAchievements에서 트리거

  // ── Generate insights whenever transaction count changes ──────────────────
  useEffect(() => {
    if (transactions.length === prevTxCountRef.current) return;
    prevTxCountRef.current = transactions.length;

    const all = generateInsights(transactions, budgetSettings, categorySpend, incomeTotal, investmentTotal);
    const fresh = all.filter((i) => !dismissedRef.current.has(i.id));
    if (fresh.length > 0) setActiveInsights(fresh.slice(0, 3));
  }, [transactions.length, budgetSettings, categorySpend, incomeTotal, investmentTotal]);

  // ── Re-evaluate when budget/goals are saved ───────────────────────────────
  const saveBudget = useCallback((settings: BudgetSettings) => {
    setBudgetSettings(settings);
    localStorage.setItem('aura_budget', JSON.stringify(settings));
    dismissedRef.current.clear();
    const all = generateInsights(transactions, settings, categorySpend, incomeTotal, investmentTotal);
    setActiveInsights(all.slice(0, 3));
  }, [transactions, categorySpend, incomeTotal, investmentTotal]);

  const dismissInsight = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setActiveInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    budgetSettings,
    budgetRatios,
    categorySpend,
    incomeTotal,
    investmentTotal,
    incomeGoalRatio,
    investGoalRatio,
    activeInsights,
    saveBudget,
    dismissInsight,
  };
}
