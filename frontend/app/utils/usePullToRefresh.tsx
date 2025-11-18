import React from 'react';
import { RefreshControl } from 'react-native';
import refreshManager, { subscribeRefresh } from './refreshManager';

type Options = {
  onRefresh?: () => Promise<unknown> | void;
  color?: string;
};

export function usePullToRefresh({ onRefresh, color = '#51946b' }: Options = {}) {
  const [refreshing, setRefreshing] = React.useState(false);

  const runRefresh = React.useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (e) {
      // swallow - screen can log
      console.warn('refresh error', e);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Subscribe to global refresh events
  React.useEffect(() => {
    if (!onRefresh) return; // only subscribe if screen handles refresh
    const unsub = subscribeRefresh(() => {
      // run but don't await
      runRefresh();
    });
    return unsub;
  }, [onRefresh, runRefresh]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={runRefresh}
      colors={[color]}
      tintColor={color}
    />
  );

  return { refreshing, runRefresh, refreshControl: control, emitGlobalRefresh: refreshManager.emitRefresh };
}

export default usePullToRefresh;
