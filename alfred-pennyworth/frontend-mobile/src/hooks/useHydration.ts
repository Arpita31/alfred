import { useMemo } from 'react';
import { WaterHistory } from '../types/health';
import { useHydration as useHydrationCtx } from '../context/HydrationContext';
import { predictEndOfDayMl, calcConsistencyScore } from '../lib/ml/hydration';

export interface HydrationVM {
  totalMl: number;
  goalMl: number;
  pct: number;
  remaining: number;
  endOfDayPrediction: number;
  consistencyScore: number;
  history: WaterHistory[];
  addWater: (ml: number) => Promise<void>;
}

export function useHydration(): HydrationVM {
  const { totalMl, goalMl, history, addWater } = useHydrationCtx();

  return useMemo(() => ({
    totalMl,
    goalMl,
    pct: goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0,
    remaining: Math.max(0, goalMl - totalMl),
    endOfDayPrediction: predictEndOfDayMl(totalMl, history),
    consistencyScore: calcConsistencyScore(history, goalMl),
    history,
    addWater,
  }), [totalMl, goalMl, history, addWater]);
}
