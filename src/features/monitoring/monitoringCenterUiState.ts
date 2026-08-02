import type { MonitoringAnalyticsFilters } from '@/services/api/usageService';

export type MonitoringTab = 'accounts' | 'keys' | 'realtime';
export type MonitoringDensity = 'compact' | 'full';
export type MonitoringGranularity = 'hour' | 'day';

export type MonitoringCursor = {
  beforeMs: number | null;
  beforeId: number | null;
};

export type MonitoringCenterFilters = MonitoringAnalyticsFilters & {
  searchQuery?: string;
  searchApiKeyHash?: string;
};

export type MonitoringCenterUiState = {
  activeTab: MonitoringTab;
  density: MonitoringDensity;
  granularity: MonitoringGranularity;
  fromMs: number;
  toMs: number;
  nowMs?: number;
  timeZone?: string;
  filters: MonitoringCenterFilters;
  cursor: MonitoringCursor;
  pageLimit: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_MONITORING_PAGE_LIMIT = 200;
export const MONITORING_TABS: MonitoringTab[] = ['accounts', 'keys', 'realtime'];

export const createDefaultMonitoringCenterUiState = (
  nowMs: number = Date.now()
): MonitoringCenterUiState => ({
  activeTab: 'accounts',
  density: 'compact',
  granularity: 'hour',
  fromMs: nowMs - DAY_MS,
  toMs: nowMs,
  nowMs,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  filters: {
    includeFailed: true,
  },
  cursor: {
    beforeMs: null,
    beforeId: null,
  },
  pageLimit: DEFAULT_MONITORING_PAGE_LIMIT,
});

export const resetMonitoringCursor = (
  state: MonitoringCenterUiState
): MonitoringCenterUiState => ({
  ...state,
  cursor: {
    beforeMs: null,
    beforeId: null,
  },
});

export const setMonitoringTab = (
  state: MonitoringCenterUiState,
  activeTab: MonitoringTab
): MonitoringCenterUiState => resetMonitoringCursor({ ...state, activeTab });

export const setMonitoringDensity = (
  state: MonitoringCenterUiState,
  density: MonitoringDensity
): MonitoringCenterUiState => ({
  ...state,
  density,
});

export const setMonitoringFilters = (
  state: MonitoringCenterUiState,
  filters: MonitoringCenterFilters
): MonitoringCenterUiState => resetMonitoringCursor({ ...state, filters });

export const setMonitoringCursorFromBackend = (
  state: MonitoringCenterUiState,
  cursor: MonitoringCursor
): MonitoringCenterUiState => ({
  ...state,
  cursor,
});
