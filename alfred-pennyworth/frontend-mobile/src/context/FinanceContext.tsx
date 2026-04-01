import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FinanceState, Asset, Liability, IncomeStream, Expense, NWSnapshot } from '../types/finance';
import { FIN_KEY } from '../constants/keys';
import { storageGet, storageSet, localDateStr } from '../lib/storage/core';
import { calcNetWorth } from '../lib/ml/finance';

const DEFAULT_FINANCE: FinanceState = {
  assets: [],
  liabilities: [],
  income: [],
  expenses: [],
  nwHistory: [],
  allocation: { core: 40, growth: 40, asymmetric: 20 },
};

interface FinanceContextValue {
  finance: FinanceState;
  saveFinance: (patch: Partial<FinanceState>) => Promise<void>;
  snapshotNetWorth: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [finance, setFinance] = useState<FinanceState>(DEFAULT_FINANCE);

  useEffect(() => {
    storageGet<FinanceState>(FIN_KEY, DEFAULT_FINANCE).then(setFinance);
  }, []);

  const saveFinance = async (patch: Partial<FinanceState>) => {
    const next = { ...finance, ...patch };
    setFinance(next);
    await storageSet(FIN_KEY, next);
  };

  const snapshotNetWorth = async () => {
    const nw = calcNetWorth(finance.assets, finance.liabilities);
    const snap: NWSnapshot = { date: localDateStr(), value: nw };
    const deduped = [snap, ...finance.nwHistory.filter(s => s.date !== localDateStr())].slice(0, 365);
    await saveFinance({ nwHistory: deduped });
  };

  return (
    <FinanceContext.Provider value={{ finance, saveFinance, snapshotNetWorth }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
