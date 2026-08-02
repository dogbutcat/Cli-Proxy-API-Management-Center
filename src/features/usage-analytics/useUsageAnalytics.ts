import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { monitoringApi, usageServiceApi } from '@/services/api';
import type {
  MonitoringAnalyticsResponse,
  UsageApiResult,
  UsageStatus,
} from '@/services/api/usageService';
import { buildUsageAnalyticsModel, type UsageAnalyticsModel } from './usageAnalyticsModel';
import {
  buildUsageAnalyticsComparisonRequest,
  buildUsageAnalyticsDrilldownRequest,
  buildUsageAnalyticsRequest,
  createDefaultUsageAnalyticsUiState,
  type UsageAnalyticsUiState,
} from './usageAnalyticsUiState';

export type UsageAnalyticsResults = {
  analytics?: UsageApiResult<MonitoringAnalyticsResponse>;
  status?: UsageApiResult<UsageStatus>;
  comparison?: UsageApiResult<MonitoringAnalyticsResponse> | null;
  drilldown?: UsageApiResult<MonitoringAnalyticsResponse> | null;
};

export type UseUsageAnalyticsOptions = {
  enabled?: boolean;
  initialState?: UsageAnalyticsUiState;
};

export type UseUsageAnalyticsValue = {
  uiState: UsageAnalyticsUiState;
  setUiState: Dispatch<SetStateAction<UsageAnalyticsUiState>>;
  results: UsageAnalyticsResults;
  model: UsageAnalyticsModel;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const isSuccessLike = <T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> =>
  result.status === 'fulfilled';

export function useUsageAnalytics(options: UseUsageAnalyticsOptions = {}): UseUsageAnalyticsValue {
  const enabled = options.enabled ?? true;
  const [uiState, setUiState] = useState(
    () => options.initialState ?? createDefaultUsageAnalyticsUiState()
  );
  const [results, setResults] = useState<UsageAnalyticsResults>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAtMs, setUpdatedAtMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const hasData = hasDataRef.current;
    setLoading(!hasData);
    setRefreshing(hasData);
    const comparisonRequest = buildUsageAnalyticsComparisonRequest(uiState);
    const drilldownRequest = buildUsageAnalyticsDrilldownRequest(uiState);
    const [analytics, status, comparison, drilldown] = await Promise.allSettled([
      monitoringApi.getAnalytics(buildUsageAnalyticsRequest(uiState), controller.signal),
      usageServiceApi.getStatus(),
      comparisonRequest
        ? monitoringApi.getAnalytics(comparisonRequest, controller.signal)
        : Promise.resolve(null),
      drilldownRequest
        ? monitoringApi.getAnalytics(drilldownRequest, controller.signal)
        : Promise.resolve(null),
    ]);
    if (controller.signal.aborted) return;
    setResults((previous) => ({
      analytics: isSuccessLike(analytics) ? analytics.value : previous.analytics,
      status: isSuccessLike(status) ? status.value : previous.status,
      comparison: isSuccessLike(comparison) ? comparison.value : (previous.comparison ?? null),
      drilldown: isSuccessLike(drilldown) ? drilldown.value : (previous.drilldown ?? null),
    }));
    hasDataRef.current = true;
    setUpdatedAtMs(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, [enabled, uiState]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  const model = useMemo(
    () =>
      buildUsageAnalyticsModel({
        ...results,
        loading,
        refreshing,
        updatedAtMs,
      }),
    [loading, refreshing, results, updatedAtMs]
  );

  return {
    uiState,
    setUiState,
    results,
    model,
    loading,
    refreshing,
    refresh,
  };
}
