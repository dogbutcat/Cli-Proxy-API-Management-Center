import type {
  MonitoringAnalyticsFilters,
  MonitoringAnalyticsInclude,
  MonitoringAnalyticsRequest,
  MonitoringAnalyticsResponse,
} from '@/services/api/usageService';
import type {
  MonitoringCenterFilters,
  MonitoringCenterUiState,
  MonitoringCursor,
  MonitoringDensity,
} from '../monitoringCenterUiState';
import { refilterMonitoringEvents } from './eventRows';

export type MonitoringIssueRow = {
  key: string;
  component: string;
  kind: string;
  message: string;
};

const copyArray = (values: string[] | undefined): string[] | undefined =>
  values?.length ? [...values] : undefined;

export const buildMonitoringAnalyticsFilters = (
  filters: MonitoringCenterFilters
): MonitoringAnalyticsFilters => ({
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

export const buildMonitoringInclude = (
  density: MonitoringDensity,
  cursor: MonitoringCursor,
  limit: number,
  granularity: string
): MonitoringAnalyticsInclude => ({
  summary: true,
  summaryProfile: density,
  accountStats: true,
  apiKeyStats: true,
  filterOptions: false,
  filterSelectors: false,
  eventsPage: {
    limit,
    beforeMs: cursor.beforeMs,
    beforeId: cursor.beforeId,
  },
  granularity,
});

export const buildMonitoringSelectorsInclude = (
  granularity: string
): MonitoringAnalyticsInclude => ({
  summary: false,
  summaryProfile: 'compact',
  accountStats: false,
  apiKeyStats: false,
  filterOptions: true,
  filterSelectors: true,
  granularity,
});

const buildBaseMonitoringRequest = (
  state: MonitoringCenterUiState
): Omit<MonitoringAnalyticsRequest, 'include'> => ({
  fromMs: state.fromMs,
  toMs: state.toMs,
  nowMs: state.nowMs,
  timeZone: state.timeZone,
  searchQuery: state.filters.searchQuery,
  searchApiKeyHash: state.filters.searchApiKeyHash,
  filters: buildMonitoringAnalyticsFilters(state.filters),
});

export const buildMonitoringAnalyticsRequest = (
  state: MonitoringCenterUiState
): MonitoringAnalyticsRequest => ({
  ...buildBaseMonitoringRequest(state),
  include: buildMonitoringInclude(
    state.density,
    state.cursor,
    state.pageLimit,
    state.granularity
  ),
});

export const buildMonitoringSelectorsRequest = (
  state: MonitoringCenterUiState
): MonitoringAnalyticsRequest => ({
  ...buildBaseMonitoringRequest(state),
  include: buildMonitoringSelectorsInclude(state.granularity),
});

export const readNextMonitoringCursor = (
  analytics: MonitoringAnalyticsResponse | undefined
): MonitoringCursor => ({
  beforeMs: analytics?.events?.nextBeforeMs ?? null,
  beforeId: analytics?.events?.nextBeforeId ?? null,
});

export const mergeMonitoringRealtimePage = (
  current: MonitoringAnalyticsResponse | undefined,
  next: MonitoringAnalyticsResponse
): MonitoringAnalyticsResponse => {
  if (!current?.events?.items.length) return next;
  const seen = new Set(current.events.items.map((event) => event.eventHash || `${event.id}`));
  const additions = (next.events?.items ?? []).filter((event) => {
    const identity = event.eventHash || `${event.id}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });

  return {
    ...next,
    events: next.events
      ? {
          ...next.events,
          items: [...current.events.items, ...additions],
        }
      : current.events,
  };
};

export const refilterMonitoringAnalytics = (
  analytics: MonitoringAnalyticsResponse,
  state: MonitoringCenterUiState
): MonitoringAnalyticsResponse => {
  if (!analytics.events) return analytics;
  return {
    ...analytics,
    events: {
      ...analytics.events,
      items: refilterMonitoringEvents(
        analytics.events.items,
        buildMonitoringAnalyticsFilters(state.filters),
        state.filters.searchQuery,
        state.filters.searchApiKeyHash
      ),
    },
  };
};

export const buildMonitoringIssueRows = (
  analytics: MonitoringAnalyticsResponse | undefined
): MonitoringIssueRow[] => {
  const issues = [
    ...(analytics?.summary ? [] : []),
    ...(analytics?.events?.items.length === 0 ? [] : []),
  ];
  return issues;
};

export const buildMonitoringExportQuery = (
  state: MonitoringCenterUiState
): Record<string, string> => {
  const query: Record<string, string> = {
    from_ms: String(state.fromMs),
    to_ms: String(state.toMs),
  };
  const filters = buildMonitoringAnalyticsFilters(state.filters);
  if (state.filters.searchQuery) query.search = state.filters.searchQuery;
  if (filters.providers?.length) query.provider = filters.providers.join(',');
  if (filters.authIndices?.length) query.auth_index = filters.authIndices.join(',');
  if (filters.apiKeyHashes?.length) query.api_key_hash = filters.apiKeyHashes.join(',');
  if (filters.sourceHashes?.length) query.source_hash = filters.sourceHashes.join(',');
  if (filters.requestTypes?.length) query.request_type = filters.requestTypes.join(',');
  if (filters.headerTraceIds?.length) query.header_trace_id = filters.headerTraceIds.join(',');
  return query;
};
