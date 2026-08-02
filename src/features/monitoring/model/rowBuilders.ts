import type { MonitoringAnalyticsResponse } from '@/services/api/usageService';
import {
  buildMonitoringSearchText,
  isMonitoringRecord,
  joinMonitoringUnique,
  maskMonitoringToken,
  readMonitoringString,
} from './base';
import type { MonitoringAccountRow, MonitoringApiKeyRow, MonitoringAuthMeta } from './types';

const readNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const readNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  return readNumber(value);
};

const readArrayStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(readMonitoringString).filter(Boolean) : [];

const readAlias = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const rowAuthLabels = (
  authIndices: string[],
  authMetaByIndex: Map<string, MonitoringAuthMeta>,
  fallback: unknown
): string[] => {
  const labels = readArrayStrings(fallback);
  authIndices.forEach((authIndex) => {
    const meta = authMetaByIndex.get(authIndex);
    if (meta?.label) labels.push(meta.label);
  });
  return Array.from(new Set(labels));
};

export const buildMonitoringAccountRows = (
  analytics: MonitoringAnalyticsResponse | undefined,
  authMetaByIndex: Map<string, MonitoringAuthMeta> = new Map()
): MonitoringAccountRow[] =>
  (analytics?.accountStats ?? []).filter(isMonitoringRecord).map((item, index) => {
    const authIndices = readArrayStrings(readAlias(item, 'auth_indices', 'authIndices'));
    const account =
      readMonitoringString(readAlias(item, 'account', 'account_snapshot', 'accountSnapshot')) ||
      readMonitoringString(readAlias(item, 'auth_index', 'authIndex')) ||
      `account-${index + 1}`;
    const labels = rowAuthLabels(
      authIndices,
      authMetaByIndex,
      readAlias(item, 'auth_labels', 'authLabels')
    );
    const channels = readArrayStrings(readAlias(item, 'channels', 'providers'));
    const totalCalls = readNumber(readAlias(item, 'total_calls', 'totalCalls', 'calls'));
    const successCalls = readNumber(readAlias(item, 'success_calls', 'successCalls'));
    const failureCalls = readNumber(readAlias(item, 'failure_calls', 'failureCalls'));

    return {
      id: readMonitoringString(readAlias(item, 'id', 'account_hash', 'accountHash')) || account,
      account,
      displayAccount: labels[0] || account,
      authLabels: labels,
      authIndices,
      channels,
      totalCalls,
      successCalls,
      failureCalls,
      successRate:
        readNumber(readAlias(item, 'success_rate', 'successRate')) ||
        (totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0),
      totalTokens: readNumber(readAlias(item, 'total_tokens', 'totalTokens')),
      totalCost: readNumber(readAlias(item, 'total_cost', 'totalCost')),
      averageLatencyMs: readNullableNumber(
        readAlias(item, 'average_latency_ms', 'averageLatencyMs', 'avg_latency_ms')
      ),
      lastSeenAt: readNumber(readAlias(item, 'last_seen_at', 'lastSeenAt', 'last_seen_at_ms')),
    };
  });

export const buildMonitoringApiKeyRows = (
  analytics: MonitoringAnalyticsResponse | undefined,
  authMetaByIndex: Map<string, MonitoringAuthMeta> = new Map()
): MonitoringApiKeyRow[] =>
  (analytics?.apiKeyStats ?? []).filter(isMonitoringRecord).map((item, index) => {
    const apiKeyHash =
      readMonitoringString(readAlias(item, 'api_key_hash', 'apiKeyHash')) || `key-${index + 1}`;
    const authIndices = readArrayStrings(readAlias(item, 'auth_indices', 'authIndices'));
    const authLabels = rowAuthLabels(
      authIndices,
      authMetaByIndex,
      readAlias(item, 'auth_labels', 'authLabels')
    );
    const sourceLabels = readArrayStrings(readAlias(item, 'source_labels', 'sourceLabels'));
    const totalCalls = readNumber(readAlias(item, 'total_calls', 'totalCalls', 'calls'));
    const successCalls = readNumber(readAlias(item, 'success_calls', 'successCalls'));
    const failureCalls = readNumber(readAlias(item, 'failure_calls', 'failureCalls'));

    return {
      id: readMonitoringString(readAlias(item, 'id', 'key_hash', 'keyHash')) || apiKeyHash,
      apiKeyHash,
      apiKeyLabel:
        readMonitoringString(readAlias(item, 'api_key_label', 'apiKeyLabel')) ||
        maskMonitoringToken(apiKeyHash),
      authLabels,
      sourceLabels: sourceLabels.length ? sourceLabels : [joinMonitoringUnique(authLabels)],
      totalCalls,
      successCalls,
      failureCalls,
      successRate:
        readNumber(readAlias(item, 'success_rate', 'successRate')) ||
        (totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0),
      totalTokens: readNumber(readAlias(item, 'total_tokens', 'totalTokens')),
      totalCost: readNumber(readAlias(item, 'total_cost', 'totalCost')),
      averageLatencyMs: readNullableNumber(
        readAlias(item, 'average_latency_ms', 'averageLatencyMs', 'avg_latency_ms')
      ),
      lastSeenAt: readNumber(readAlias(item, 'last_seen_at', 'lastSeenAt', 'last_seen_at_ms')),
    };
  });

export const filterMonitoringAccountRows = (
  rows: MonitoringAccountRow[],
  query: string
): MonitoringAccountRow[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    buildMonitoringSearchText(
      row.account,
      row.displayAccount,
      ...row.authLabels,
      ...row.authIndices,
      ...row.channels
    ).includes(normalized)
  );
};

export const filterMonitoringApiKeyRows = (
  rows: MonitoringApiKeyRow[],
  query: string
): MonitoringApiKeyRow[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    buildMonitoringSearchText(
      row.apiKeyHash,
      row.apiKeyLabel,
      ...row.authLabels,
      ...row.sourceLabels
    ).includes(normalized)
  );
};
