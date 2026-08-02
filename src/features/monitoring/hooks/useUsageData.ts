import { useCallback, useEffect, useState } from 'react';
import { usageServiceApi } from '@/services/api';
import type { UsageCapabilities, UsageApiResult, UsageStatus } from '@/services/api/usageService';

export type MonitoringUsageState = {
  capabilities?: UsageApiResult<UsageCapabilities>;
  status?: UsageApiResult<UsageStatus>;
  loading: boolean;
  error: string;
  updatedAtMs: number | null;
};

export function useUsageData(enabled = true) {
  const [state, setState] = useState<MonitoringUsageState>({
    loading: false,
    error: '',
    updatedAtMs: null,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    const [capabilities, status] = await Promise.all([
      usageServiceApi.getCapabilities(),
      usageServiceApi.getStatus(),
    ]);
    setState({
      capabilities,
      status,
      loading: false,
      error:
        capabilities.kind === 'error'
          ? capabilities.message
          : status.kind === 'error'
            ? status.message
            : '',
      updatedAtMs: Date.now(),
    });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
