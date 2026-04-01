import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WaterHistory } from '../types/health';
import { WATER_KEY, WATER_HIST_KEY } from '../constants/keys';
import { storageGet, storageGetArray, storageSet, localDateStr } from '../lib/storage/core';
import { logWater } from '../lib/api/meals';
import { calcDynamicGoal } from '../lib/ml/hydration';
import { useApp } from './AppContext';

// Stored alongside the daily total so we can detect date rollovers.
const WATER_DATE_KEY = 'alfred_water_date';

interface HydrationContextValue {
  totalMl: number;
  goalMl: number;
  history: WaterHistory[];
  addWater: (ml: number) => Promise<void>;
}

const HydrationContext = createContext<HydrationContextValue | null>(null);

export function HydrationProvider({ children }: { children: ReactNode }) {
  const { sharedCtx, patchSharedCtx } = useApp();
  const [totalMl, setTotalMl] = useState(0);
  const [history, setHistory] = useState<WaterHistory[]>([]);

  const goalMl = calcDynamicGoal(
    sharedCtx.activityMinutesToday,
    sharedCtx.lastSleepHours,
    sharedCtx.lastSleepQuality,
  );

  useEffect(() => {
    (async () => {
      const today = localDateStr();
      const storedDate = await storageGet<string>(WATER_DATE_KEY, '');
      const storedMl   = await storageGet<number>(WATER_KEY, 0);
      const hist       = await storageGetArray<WaterHistory>(WATER_HIST_KEY);

      if (storedDate && storedDate !== today && storedMl > 0) {
        // New day — archive yesterday's total then reset
        const entry: WaterHistory = { date: storedDate, totalMl: storedMl, goalMl };
        const nextHist = [entry, ...hist];
        await storageSet(WATER_HIST_KEY, nextHist);
        await storageSet(WATER_KEY, 0);
        await storageSet(WATER_DATE_KEY, today);
        setHistory(nextHist);
        setTotalMl(0);
      } else {
        if (!storedDate) await storageSet(WATER_DATE_KEY, today);
        setHistory(hist);
        setTotalMl(storedMl);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addWater = async (ml: number) => {
    const next = totalMl + ml;
    setTotalMl(next);
    await storageSet(WATER_KEY, next);
    await storageSet(WATER_DATE_KEY, localDateStr());
    await logWater(ml).catch(() => null);
    await patchSharedCtx({});
  };

  return (
    <HydrationContext.Provider value={{ totalMl, goalMl, history, addWater }}>
      {children}
    </HydrationContext.Provider>
  );
}

export function useHydration(): HydrationContextValue {
  const ctx = useContext(HydrationContext);
  if (!ctx) throw new Error('useHydration must be used within HydrationProvider');
  return ctx;
}
