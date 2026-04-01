import { useState, useMemo } from 'react';
import { useFinance as useFinanceCtx } from '../context/FinanceContext';
import { Asset, Liability, IncomeStream, Expense } from '../types/finance';
import {
  calcNetWorth, calcSavingsRate, calcPassiveRatio,
  calcFINumber, calcYearsToFI, calcRunwayMonths,
  formatMoney, generateUid,
} from '../lib/ml/finance';

export type FinanceTab = 'overview' | 'balance' | 'cashflow' | 'fi';

export interface FinanceVM {
  finance: ReturnType<typeof useFinanceCtx>['finance'];
  activeTab: FinanceTab;
  setActiveTab: (t: FinanceTab) => void;
  // computed
  netWorth: number;
  netWorthFmt: string;
  savingsRate: number;
  passiveRatio: number;
  fiNumber: number;
  yearsToFI: number;
  runwayMonths: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  // mutators
  addAsset: (a: Omit<Asset, 'id'>) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  addLiability: (l: Omit<Liability, 'id'>) => Promise<void>;
  removeLiability: (id: string) => Promise<void>;
  addIncome: (s: Omit<IncomeStream, 'id'>) => Promise<void>;
  removeIncome: (id: string) => Promise<void>;
  addExpense: (e: Omit<Expense, 'id'>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  snapshotNetWorth: () => Promise<void>;
}

export function useFinance(): FinanceVM {
  const { finance, saveFinance, snapshotNetWorth } = useFinanceCtx();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');

  const computed = useMemo(() => {
    const nw            = calcNetWorth(finance.assets, finance.liabilities);
    const monthlyIncome = finance.income.reduce((s, i) => s + i.monthlyAmount, 0);
    const monthlyExp    = finance.expenses.reduce((s, e) => s + e.monthlyAmount, 0);
    const fiNumber      = calcFINumber(monthlyExp);
    const contribution  = monthlyIncome - monthlyExp;
    return {
      netWorth: nw,
      netWorthFmt: formatMoney(nw, true),
      savingsRate: calcSavingsRate(monthlyIncome, monthlyExp),
      passiveRatio: calcPassiveRatio(finance.income),
      fiNumber,
      yearsToFI: calcYearsToFI(nw, fiNumber, contribution),
      runwayMonths: calcRunwayMonths(finance.assets, monthlyExp),
      monthlyIncome,
      monthlyExpenses: monthlyExp,
    };
  }, [finance]);

  const addAsset      = (a: Omit<Asset, 'id'>)        => saveFinance({ assets:       [...finance.assets,       { ...a, id: generateUid() }] });
  const removeAsset   = (id: string)                   => saveFinance({ assets:       finance.assets.filter(x => x.id !== id) });
  const addLiability  = (l: Omit<Liability, 'id'>)     => saveFinance({ liabilities:  [...finance.liabilities,  { ...l, id: generateUid() }] });
  const removeLiability = (id: string)                 => saveFinance({ liabilities:  finance.liabilities.filter(x => x.id !== id) });
  const addIncome     = (s: Omit<IncomeStream, 'id'>)  => saveFinance({ income:       [...finance.income,       { ...s, id: generateUid() }] });
  const removeIncome  = (id: string)                   => saveFinance({ income:       finance.income.filter(x => x.id !== id) });
  const addExpense    = (e: Omit<Expense, 'id'>)       => saveFinance({ expenses:     [...finance.expenses,     { ...e, id: generateUid() }] });
  const removeExpense = (id: string)                   => saveFinance({ expenses:     finance.expenses.filter(x => x.id !== id) });

  return {
    finance,
    activeTab, setActiveTab,
    ...computed,
    addAsset, removeAsset,
    addLiability, removeLiability,
    addIncome, removeIncome,
    addExpense, removeExpense,
    snapshotNetWorth,
  };
}
