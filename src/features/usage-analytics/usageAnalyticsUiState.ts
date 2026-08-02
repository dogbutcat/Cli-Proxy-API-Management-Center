import type {
  MonitoringAnalyticsFilters,
  MonitoringAnalyticsInclude,
  MonitoringAnalyticsRequest,
} from '@/services/api/usageService';

export type UsageAnalyticsGranularity = 'hour' | 'day';

export type UsageAnalyticsTab =
  'overview' | 'trend' | 'models' | 'clientKeys' | 'credentials' | 'heatmap';

export type UsageAnalyticsFilters = MonitoringAnalyticsFilters & {
  searchQuery?: string;
  searchApiKeyHash?: string;
};

export type UsageAnalyticsComparisonState = {
  enabled: boolean;
  fromMs: number;
  toMs: number;
};

export type UsageAnalyticsDrilldownTarget = {
  surface: 'overview' | 'trend' | 'model' | 'clientKey' | 'credential' | 'provider' | 'heatmap';
  id: string;
  filters?: UsageAnalyticsFilters;
};

export type UsageAnalyticsDrilldownState = {
  enabled: boolean;
  limit: number;
  beforeMs: number | null;
  beforeId: number | null;
  target?: UsageAnalyticsDrilldownTarget;
};

export type UsageAnalyticsUiState = {
  tab: UsageAnalyticsTab;
  fromMs: number;
  toMs: number;
  nowMs: number;
  timeZone: string;
  granularity: UsageAnalyticsGranularity;
  filters: UsageAnalyticsFilters;
  comparison: UsageAnalyticsComparisonState;
  drilldown: UsageAnalyticsDrilldownState;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const USAGE_ANALYTICS_DEFAULT_PAGE_LIMIT = 200;
export const USAGE_ANALYTICS_TABS: UsageAnalyticsTab[] = [
  'overview',
  'trend',
  'models',
  'clientKeys',
  'credentials',
  'heatmap',
];

const copyArray = (values: string[] | undefined): string[] | undefined =>
  values?.length ? [...values] : undefined;

const cleanFilters = (filters: UsageAnalyticsFilters = {}): MonitoringAnalyticsFilters => ({
  models: copyArray(filters.models),
  providers: copyArray(filters.providers),
  accounts: copyArray(filters.accounts),
  credentialIds: copyArray(filters.credentialIds),
  authFiles: copyArray(filters.authFiles),
  authIndices: copyArray(filters.authIndices),
  apiKeyHashes: copyArray(filters.apiKeyHashes),
  sourceHashes: copyArray(filters.sourceHashes),
  projectIds: copyArray(filters.projectIds),
  requestTypes: copyArray(filters.requestTypes),
  headerErrorKinds: copyArray(filters.headerErrorKinds),
  headerErrorCodes: copyArray(filters.headerErrorCodes),
  headerQuotaPlans: copyArray(filters.headerQuotaPlans),
  headerTraceIds: copyArray(filters.headerTraceIds),
  includeFailed: filters.includeFailed,
  failedOnly: filters.failedOnly,
  minLatencyMs: filters.minLatencyMs,
  cacheStatus: filters.cacheStatus,
});

const mergeFilters = (
  base: UsageAnalyticsFilters,
  override: UsageAnalyticsFilters | undefined
): UsageAnalyticsFilters => ({ ...base, ...override });

export const createDefaultUsageAnalyticsUiState = (
  nowMs = Date.now(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): UsageAnalyticsUiState => ({
  tab: 'overview',
  fromMs: nowMs - 7 * DAY_MS,
  toMs: nowMs,
  nowMs,
  timeZone,
  granularity: 'day',
  filters: {
    includeFailed: true,
  },
  comparison: {
    enabled: false,
    fromMs: nowMs - 14 * DAY_MS,
    toMs: nowMs - 7 * DAY_MS,
  },
  drilldown: {
    enabled: false,
    limit: USAGE_ANALYTICS_DEFAULT_PAGE_LIMIT,
    beforeMs: null,
    beforeId: null,
  },
});

export const buildUsageAnalyticsInclude = (
  granularity: UsageAnalyticsGranularity,
  eventsPage?: MonitoringAnalyticsInclude['eventsPage']
): MonitoringAnalyticsInclude => ({
  summary: true,
  summaryProfile: 'full',
  accountStats: true,
  apiKeyStats: true,
  filterOptions: true,
  filterSelectors: true,
  recentFailures: 10,
  granularity,
  eventsPage,
});

export const buildUsageAnalyticsRequest = (
  state: UsageAnalyticsUiState
): MonitoringAnalyticsRequest => ({
  fromMs: state.fromMs,
  toMs: state.toMs,
  nowMs: state.nowMs,
  timeZone: state.timeZone,
  searchQuery: state.filters.searchQuery,
  searchApiKeyHash: state.filters.searchApiKeyHash,
  filters: cleanFilters(state.filters),
  include: buildUsageAnalyticsInclude(state.granularity),
});

export const buildUsageAnalyticsComparisonRequest = (
  state: UsageAnalyticsUiState
): MonitoringAnalyticsRequest | null =>
  state.comparison.enabled
    ? {
        ...buildUsageAnalyticsRequest(state),
        fromMs: state.comparison.fromMs,
        toMs: state.comparison.toMs,
      }
    : null;

export const buildUsageAnalyticsDrilldownRequest = (
  state: UsageAnalyticsUiState
): MonitoringAnalyticsRequest | null => {
  if (!state.drilldown.enabled) return null;
  const filters = mergeFilters(state.filters, state.drilldown.target?.filters);
  return {
    ...buildUsageAnalyticsRequest({
      ...state,
      filters,
    }),
    filters: cleanFilters(filters),
    searchQuery: filters.searchQuery,
    searchApiKeyHash: filters.searchApiKeyHash,
    include: buildUsageAnalyticsInclude(state.granularity, {
      limit: state.drilldown.limit,
      beforeMs: state.drilldown.beforeMs,
      beforeId: state.drilldown.beforeId,
    }),
  };
};

export const setUsageAnalyticsTab = (
  state: UsageAnalyticsUiState,
  tab: UsageAnalyticsTab
): UsageAnalyticsUiState => ({
  ...state,
  tab,
});

export const setUsageAnalyticsGranularity = (
  state: UsageAnalyticsUiState,
  granularity: UsageAnalyticsGranularity
): UsageAnalyticsUiState => ({
  ...state,
  granularity,
});

export const setUsageAnalyticsFilters = (
  state: UsageAnalyticsUiState,
  filters: UsageAnalyticsFilters
): UsageAnalyticsUiState => ({
  ...state,
  filters,
  drilldown: {
    ...state.drilldown,
    enabled: false,
    beforeMs: null,
    beforeId: null,
  },
});

export const setUsageAnalyticsComparisonEnabled = (
  state: UsageAnalyticsUiState,
  enabled: boolean
): UsageAnalyticsUiState => ({
  ...state,
  comparison: {
    ...state.comparison,
    enabled,
  },
});

export const openUsageAnalyticsDrilldown = (
  state: UsageAnalyticsUiState,
  target: UsageAnalyticsDrilldownTarget
): UsageAnalyticsUiState => ({
  ...state,
  drilldown: {
    ...state.drilldown,
    enabled: true,
    target,
    beforeMs: null,
    beforeId: null,
  },
});
