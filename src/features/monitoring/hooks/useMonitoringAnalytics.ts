import { useCallback, useEffect, useState } from 'react';
import { monitoringApi } from '@/services/api';
import type { MonitoringAnalyticsResponse, UsageApiResult } from '@/services/api/usageService';
import type { MonitoringCenterUiState } from '../monitoringCenterUiState';
import {
  buildMonitoringAnalyticsRequest,
  buildMonitoringSelectorsRequest,
  mergeMonitoringRealtimePage,
  readNextMonitoringCursor,
  refilterMonitoringAnalytics,
} from '../model/monitoringCenterPageModel';
import { selectorsFromAnalytics, type MonitoringSelectorSet } from '../model/selectorAdapters';

export type MonitoringAnalyticsState = {
  analytics?: MonitoringAnalyticsResponse;
  selectors: MonitoringSelectorSet;
  result?: UsageApiResult<MonitoringAnalyticsResponse>;
  selectorResult?: UsageApiResult<MonitoringAnalyticsResponse>;
  loading: boolean;
  selectorLoading: boolean;
  error: string;
  hasMore: boolean;
  nextBeforeMs: number | null;
  nextBeforeId: number | null;
  updatedAtMs: number | null;
};

const EMPTY_SELECTORS: MonitoringSelectorSet = {
  providers: [],
  models: [],
  accounts: [],
  authIndices: [],
  apiKeyHashes: [],
  sourceHashes: [],
  requestTypes: [],
  headerTraceIds: [],
};

const isSuccessLike = (
  result: UsageApiResult<MonitoringAnalyticsResponse>
): result is Extract<UsageApiResult<MonitoringAnalyticsResponse>, { data: MonitoringAnalyticsResponse }> =>
  result.kind === 'success' || result.kind === 'empty';

export function useMonitoringAnalytics(uiState: MonitoringCenterUiState, enabled = true) {
  const [state, setState] = useState<MonitoringAnalyticsState>({
    selectors: EMPTY_SELECTORS,
    loading: false,
    selectorLoading: false,
    error: '',
    hasMore: false,
    nextBeforeMs: null,
    nextBeforeId: null,
    updatedAtMs: null,
  });

  const loadSelectors = useCallback(async () => {
    if (!enabled) return;
    setState((previous) => ({ ...previous, selectorLoading: true }));
    const result = await monitoringApi.getAnalytics(buildMonitoringSelectorsRequest(uiState));
    setState((previous) => {
      const selectors = isSuccessLike(result) ? selectorsFromAnalytics(result.data) : previous.selectors;
      return {
        ...previous,
        selectors,
        selectorResult: result,
        selectorLoading: false,
      };
    });
  }, [enabled, uiState]);

  const loadAnalytics = useCallback(
    async (
      append = false,
      cursorOverride?: { beforeMs: number | null; beforeId: number | null }
    ) => {
      if (!enabled) return;
      setState((previous) => ({ ...previous, loading: true, error: '' }));
      const requestState = cursorOverride
        ? {
            ...uiState,
            cursor: cursorOverride,
          }
        : uiState;
      const result = await monitoringApi.getAnalytics(buildMonitoringAnalyticsRequest(requestState));
      setState((previous) => {
        if (!isSuccessLike(result)) {
          return {
            ...previous,
            result,
            loading: false,
            error: result.kind === 'error' || result.kind === 'unsupported' ? result.message : '',
          };
        }
        const filtered = refilterMonitoringAnalytics(result.data, uiState);
        const analytics = append
          ? mergeMonitoringRealtimePage(previous.analytics, filtered)
          : filtered;
        const cursor = readNextMonitoringCursor(analytics);
        return {
          ...previous,
          analytics,
          result,
          loading: false,
          error: '',
          hasMore: Boolean(analytics.events?.hasMore),
          nextBeforeMs: cursor.beforeMs,
          nextBeforeId: cursor.beforeId,
          updatedAtMs: Date.now(),
        };
      });
    },
    [enabled, uiState]
  );

  const refresh = useCallback(async () => {
    await Promise.all([loadAnalytics(false), loadSelectors()]);
  }, [loadAnalytics, loadSelectors]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    loadNextPage: (cursor: { beforeMs: number | null; beforeId: number | null }) =>
      loadAnalytics(true, cursor),
  };
}
