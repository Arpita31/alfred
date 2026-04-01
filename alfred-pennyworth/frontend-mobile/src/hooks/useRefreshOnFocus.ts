import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

/**
 * Re-reads the shared AppContext from storage whenever the screen gains focus.
 * Prevents stale cross-domain totals (e.g. activityMinutesToday on Dashboard)
 * after another tab updated them.
 */
export function useRefreshOnFocus() {
  const { refreshSharedCtx } = useApp();
  const firstRender = useRef(true);

  useFocusEffect(
    useCallback(() => {
      // Skip the very first mount — AppContext already hydrates on boot.
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      refreshSharedCtx();
    }, [refreshSharedCtx]),
  );
}
