import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SleepRecord } from '../types/health';
import { SLEEP_KEY } from '../constants/keys';
import { storageGetArray, storageSet, localDateStr } from '../lib/storage/core';
import { createSleep } from '../lib/api/sleep';
import { calcSleepScore } from '../lib/ml/sleep';
import { useApp } from './AppContext';

interface SaveSleepParams {
  start: string;
  end: string;
  hours: number;
  quality: number;
  tags: string[];
}

interface SleepContextValue {
  history: SleepRecord[];
  saveSleep: (params: SaveSleepParams) => Promise<void>;
  logNap: (durationHours: number) => Promise<void>;
}

const SleepContext = createContext<SleepContextValue | null>(null);

export function SleepProvider({ children }: { children: ReactNode }) {
  const { patchSharedCtx } = useApp();
  const [history, setHistory] = useState<SleepRecord[]>([]);

  useEffect(() => {
    storageGetArray<SleepRecord>(SLEEP_KEY).then(setHistory);
  }, []);

  const saveSleep = async ({ start, end, hours, quality, tags }: SaveSleepParams) => {
    const score = calcSleepScore(hours, quality, history);
    const record: SleepRecord = { date: localDateStr(), start, end, hours, quality, score, tags };
    const next = [record, ...history];
    setHistory(next);
    await storageSet(SLEEP_KEY, next);
    await createSleep({ start, end, quality, notes: tags.join(', ') }).catch(() => null);
    await patchSharedCtx({ lastSleepHours: hours, lastSleepQuality: quality });
  };

  const logNap = async (durationHours: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - durationHours * 3_600_000).toISOString();
    const end = now.toISOString();
    await saveSleep({ start, end, hours: durationHours, quality: 6, tags: ['nap'] });
  };

  return (
    <SleepContext.Provider value={{ history, saveSleep, logNap }}>
      {children}
    </SleepContext.Provider>
  );
}

export function useSleep(): SleepContextValue {
  const ctx = useContext(SleepContext);
  if (!ctx) throw new Error('useSleep must be used within SleepProvider');
  return ctx;
}
