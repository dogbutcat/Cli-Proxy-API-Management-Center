import type { MonitoringAnalyticsFilters, MonitoringEvent } from '@/services/api/usageService';
import { buildMonitoringSearchText } from './base';
import { buildMonitoringSafeLogsPath, deriveMonitoringSourceIdentity } from './sourceDisplay';
import type { MonitoringAuthMeta } from './types';

export type MonitoringEventRow = {
  id: string;
  event: MonitoringEvent;
  timestampMs: number;
  label: string;
  provider: string;
  model: string;
  endpoint: string;
  authIndex: string;
  totalTokens: number;
  failed: boolean;
  traceId: string;
  logsPath: string;
  searchText: string;
};

const lowerSet = (values?: string[]): Set<string> =>
  new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));

const matchesAny = (value: string | undefined, allowed: Set<string>): boolean =>
  allowed.size === 0 || allowed.has((value ?? '').trim().toLowerCase());

const matchesSearch = (event: MonitoringEvent, searchQuery?: string): boolean => {
  const query = (searchQuery ?? '').trim().toLowerCase();
  if (!query) return true;
  return buildMonitoringSearchText(
    event.provider,
    event.model,
    event.resolvedModel,
    event.endpoint,
    event.path,
    event.authIndex,
    event.sourceHash,
    event.apiKeyHash,
    event.headerTraceId,
    event.failSummary
  ).includes(query);
};

export const monitoringEventPassesFilters = (
  event: MonitoringEvent,
  filters: MonitoringAnalyticsFilters = {},
  searchQuery?: string,
  searchApiKeyHash?: string
): boolean => {
  if (!matchesSearch(event, searchQuery)) return false;
  if (searchApiKeyHash && event.apiKeyHash !== searchApiKeyHash) return false;
  if (filters.failedOnly && !event.failed) return false;
  if (filters.includeFailed === false && event.failed) return false;
  if (filters.minLatencyMs !== undefined && (event.latencyMs ?? 0) < filters.minLatencyMs) {
    return false;
  }
  if (!matchesAny(event.provider, lowerSet(filters.providers))) return false;
  if (!matchesAny(event.model, lowerSet(filters.models))) return false;
  if (!matchesAny(event.authIndex, lowerSet(filters.authIndices))) return false;
  if (!matchesAny(event.apiKeyHash, lowerSet(filters.apiKeyHashes))) return false;
  if (!matchesAny(event.sourceHash, lowerSet(filters.sourceHashes))) return false;
  if (!matchesAny(event.endpoint || event.path, lowerSet(filters.requestTypes))) return false;
  if (!matchesAny(event.headerTraceId, lowerSet(filters.headerTraceIds))) return false;
  return true;
};

export const refilterMonitoringEvents = (
  events: MonitoringEvent[],
  filters: MonitoringAnalyticsFilters = {},
  searchQuery?: string,
  searchApiKeyHash?: string
): MonitoringEvent[] =>
  events.filter((event) =>
    monitoringEventPassesFilters(event, filters, searchQuery, searchApiKeyHash)
  );

export const buildMonitoringEventRows = (
  events: MonitoringEvent[],
  authMetaByIndex: Map<string, MonitoringAuthMeta> = new Map()
): MonitoringEventRow[] =>
  events.map((event, index) => {
    const source = deriveMonitoringSourceIdentity(event, authMetaByIndex.get(event.authIndex));
    const id = event.eventHash || event.requestId || `${event.timestampMs}:${event.id ?? index}`;
    return {
      id,
      event,
      timestampMs: event.timestampMs,
      label: source.label,
      provider: source.provider || event.provider || '-',
      model: event.resolvedModel || event.model || '-',
      endpoint: event.endpoint || event.path || '-',
      authIndex: event.authIndex,
      totalTokens: event.totalTokens,
      failed: event.failed,
      traceId: event.headerTraceId || '',
      logsPath: buildMonitoringSafeLogsPath(source.safeQuery),
      searchText: buildMonitoringSearchText(
        source.label,
        source.identityKey,
        source.provider,
        event.model,
        event.endpoint,
        event.authIndex,
        event.headerTraceId
      ),
    };
  });
