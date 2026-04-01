import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { AppContext as AppCtxType } from '../types/health';
import { getHealth } from '../lib/api/health';
import { apiRequest, onUnauthorized } from '../lib/api/client';
import { readContext, writeContext } from '../lib/storage/context';
import { flushQueue, getQueueLength } from '../lib/storage/offlineQueue';
import { getUserId } from '../lib/auth/tokenStore';

interface AppContextValue {
  userId: number;
  apiOnline: boolean;
  queuedCount: number;
  sharedCtx: AppCtxType;
  patchSharedCtx: (partial: Partial<AppCtxType>) => Promise<void>;
  refreshSharedCtx: () => Promise<void>;
  logout: () => void;         // set by AuthContext via setLogout
}

const AppContext = createContext<AppContextValue | null>(null);

// Allows AuthContext (above) to inject the logout handler after auth is resolved
let _logoutHandler: () => void = () => {};
export const registerLogout = (fn: () => void) => { _logoutHandler = fn; };

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId]       = useState(1);
  const [apiOnline, setApiOnline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [sharedCtx, setSharedCtx] = useState<AppCtxType>({
    mealsToday: 0,
    lastSleepHours: null,
    lastSleepQuality: null,
    activityMinutesToday: 0,
  });

  // Re-check connectivity every 60s
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      await getHealth();
      setApiOnline(true);
      // Flush any requests queued while offline
      await flushQueue(apiRequest);
      setQueuedCount(0);
    } catch {
      setApiOnline(false);
      const n = await getQueueLength();
      setQueuedCount(n);
    }
  }, []);

  useEffect(() => {
    getUserId().then(setUserId);
    readContext().then(setSharedCtx);
    checkHealth();
    // Subscribe to 401 events from apiRequest
    const unsub = onUnauthorized(() => _logoutHandler());
    pollRef.current = setInterval(checkHealth, 60_000);
    return () => {
      unsub();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkHealth]);

  const refreshSharedCtx = useCallback(async () => {
    const ctx = await readContext();
    setSharedCtx(ctx);
  }, []);

  const patchSharedCtx = async (partial: Partial<AppCtxType>) => {
    await writeContext(partial);
    setSharedCtx(prev => ({ ...prev, ...partial }));
  };

  return (
    <AppContext.Provider value={{
      userId, apiOnline, queuedCount,
      sharedCtx, patchSharedCtx, refreshSharedCtx,
      logout: () => _logoutHandler(),
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
