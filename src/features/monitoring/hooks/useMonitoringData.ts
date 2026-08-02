import { useMemo, useState } from 'react';
import { buildMonitoringAuthMetaMap } from '../model/authMeta';
import {
  buildMonitoringAccountRows,
  buildMonitoringApiKeyRows,
  filterMonitoringAccountRows,
  filterMonitoringApiKeyRows,
} from '../model/rowBuilders';
import { buildMonitoringEventRows } from '../model/eventRows';
import type { AuthFileItem } from '@/types/authFile';
import {
  createDefaultMonitoringCenterUiState,
  type MonitoringCenterUiState,
} from '../monitoringCenterUiState';
import { useMonitoringAnalytics } from './useMonitoringAnalytics';
import { useUsageData } from './useUsageData';

export type UseMonitoringDataOptions = {
  enabled?: boolean;
  authFiles?: AuthFileItem[];
  initialState?: MonitoringCenterUiState;
};

export function useMonitoringData(options: UseMonitoringDataOptions = {}) {
  const enabled = options.enabled ?? true;
  const [uiState, setUiState] = useState<MonitoringCenterUiState>(
    options.initialState ?? createDefaultMonitoringCenterUiState()
  );
  const analytics = useMonitoringAnalytics(uiState, enabled);
  const usage = useUsageData(enabled);
  const authMetaByIndex = useMemo(
    () => buildMonitoringAuthMetaMap(options.authFiles ?? []),
    [options.authFiles]
  );
  const accountRows = useMemo(
    () =>
      filterMonitoringAccountRows(
        buildMonitoringAccountRows(analytics.analytics, authMetaByIndex),
        uiState.filters.searchQuery ?? ''
      ),
    [analytics.analytics, authMetaByIndex, uiState.filters.searchQuery]
  );
  const apiKeyRows = useMemo(
    () =>
      filterMonitoringApiKeyRows(
        buildMonitoringApiKeyRows(analytics.analytics, authMetaByIndex),
        uiState.filters.searchQuery ?? ''
      ),
    [analytics.analytics, authMetaByIndex, uiState.filters.searchQuery]
  );
  const eventRows = useMemo(
    () => buildMonitoringEventRows(analytics.analytics?.events?.items ?? [], authMetaByIndex),
    [analytics.analytics, authMetaByIndex]
  );

  const loadNextPage = async () => {
    if (!analytics.hasMore || analytics.nextBeforeMs === null || analytics.nextBeforeId === null) {
      return;
    }
    await analytics.loadNextPage({
      beforeMs: analytics.nextBeforeMs,
      beforeId: analytics.nextBeforeId,
    });
  };

  return {
    uiState,
    setUiState,
    usage,
    analytics,
    accountRows,
    apiKeyRows,
    eventRows,
    loadNextPage,
  };
}
