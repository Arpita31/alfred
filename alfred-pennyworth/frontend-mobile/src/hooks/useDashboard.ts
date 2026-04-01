import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useHydration } from '../context/HydrationContext';
import { useSleep } from '../context/SleepContext';
import { useActivity } from '../context/ActivityContext';
import { useFinance } from '../context/FinanceContext';
import { calcNetWorth, calcSavingsRate, formatMoney } from '../lib/ml/finance';
import { calcSleepScore } from '../lib/ml/sleep';
import { calcRecovery } from '../lib/ml/activity';

export interface DashboardStats {
  netWorth: string;
  savingsRate: number;
  sleepScore: number | null;
  recovery: { label: string; score: number; color: string } | null;
  waterPct: number;
  apiOnline: boolean;
}

export function useDashboard(): DashboardStats {
  const { apiOnline, sharedCtx } = useApp();
  const { totalMl, goalMl } = useHydration();
  const { history: sleepHistory } = useSleep();
  const { history: actHistory } = useActivity();
  const { finance } = useFinance();

  return useMemo(() => {
    const nw = calcNetWorth(finance.assets, finance.liabilities);
    const monthlyIncome = finance.income.reduce((s, i) => s + i.monthlyAmount, 0);
    const monthlyExp    = finance.expenses.reduce((s, e) => s + e.monthlyAmount, 0);

    const lastSleep = sleepHistory[0];
    const sleepScore = lastSleep
      ? calcSleepScore(lastSleep.hours, lastSleep.quality, sleepHistory.slice(1))
      : null;

    const recovery = actHistory.length > 0
      ? calcRecovery(actHistory, sharedCtx.lastSleepHours)
      : null;

    return {
      netWorth: formatMoney(nw, true),
      savingsRate: calcSavingsRate(monthlyIncome, monthlyExp),
      sleepScore,
      recovery,
      waterPct: goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0,
      apiOnline,
    };
  }, [apiOnline, sharedCtx, totalMl, goalMl, sleepHistory, actHistory, finance]);
}
