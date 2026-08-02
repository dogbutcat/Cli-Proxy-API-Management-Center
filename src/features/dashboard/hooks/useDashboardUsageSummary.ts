import { useCallback, useEffect, useState } from 'react';
import { dashboardApi, usageServiceApi } from '@/services/api';
import {
  createEmptyDashboardUsageSlice,
  getDashboardTodayStartMs,
  markDashboardUsageDisconnected,
  markDashboardUsageLoading,
  reduceDashboardUsageSlice,
} from '../utils';

export interface UseDashboardUsageSummaryOptions {
  enabled?: boolean;
}

export function useDashboardUsageSummary(options: UseDashboardUsageSummaryOptions = {}) {
  const enabled = options.enabled ?? true;
  const [usage, setUsage] = useState(createEmptyDashboardUsageSlice);

  const loadUsageSummary = useCallback(async () => {
    if (!enabled) {
      setUsage((previous) => markDashboardUsageDisconnected(previous));
      return;
    }

    setUsage((previous) => markDashboardUsageLoading(previous));
    const nowMs = Date.now();
    const todayStartMs = getDashboardTodayStartMs(nowMs);

    const [summary, status] = await Promise.allSettled([
      dashboardApi.getSummary({
        todayStartMs,
        nowMs,
        topModels: 5,
        recentFailures: 5,
      }),
      usageServiceApi.getStatus(),
    ]);

    setUsage((previous) =>
      reduceDashboardUsageSlice(previous, {
        summary,
        status,
        updatedAtMs: Date.now(),
      })
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setUsage((previous) => markDashboardUsageDisconnected(previous));
    }
  }, [enabled]);

  return { usage, loadUsageSummary };
}
