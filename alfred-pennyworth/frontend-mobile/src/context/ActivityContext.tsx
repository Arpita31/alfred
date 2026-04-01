import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ActivityRecord } from '../types/health';
import { ACT_KEY } from '../constants/keys';
import { storageGetArray, storageSet, localDateStr } from '../lib/storage/core';
import { createActivity } from '../lib/api/activity';
import { calcCalories, inferIntensity } from '../lib/ml/activity';
import { useApp } from './AppContext';
import { useProfile } from './ProfileContext';

interface SaveActivityParams {
  type: string;
  duration: number;
  start: string;
}

interface ActivityContextValue {
  history: ActivityRecord[];
  saveActivity: (params: SaveActivityParams) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { sharedCtx, patchSharedCtx } = useApp();
  const { profile } = useProfile();
  const [history, setHistory] = useState<ActivityRecord[]>([]);

  useEffect(() => {
    storageGetArray<ActivityRecord>(ACT_KEY).then(setHistory);
  }, []);

  const saveActivity = async ({ type, duration, start }: SaveActivityParams) => {
    const calories = calcCalories(type, duration, profile.weightKg);
    const intensity = inferIntensity(type);
    const record: ActivityRecord = {
      date: localDateStr(),
      type,
      duration,
      calories,
      intensity,
      start,
    };
    const next = [record, ...history];
    setHistory(next);
    await storageSet(ACT_KEY, next);
    await createActivity({ type, duration_minutes: duration, start, calories }).catch(() => null);
    await patchSharedCtx({
      activityMinutesToday: sharedCtx.activityMinutesToday + duration,
    });
  };

  return (
    <ActivityContext.Provider value={{ history, saveActivity }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider');
  return ctx;
}
