import type { MonitoringAnalyticsResponse } from '@/services/api/usageService';
import {
  extractMonitoringArrayPayload,
  isMonitoringRecord,
  readMonitoringString,
} from './base';

export type MonitoringSelectorOption = {
  value: string;
  label: string;
  count?: number;
};

export type MonitoringSelectorSet = {
  providers: MonitoringSelectorOption[];
  models: MonitoringSelectorOption[];
  accounts: MonitoringSelectorOption[];
  authIndices: MonitoringSelectorOption[];
  apiKeyHashes: MonitoringSelectorOption[];
  sourceHashes: MonitoringSelectorOption[];
  requestTypes: MonitoringSelectorOption[];
  headerTraceIds: MonitoringSelectorOption[];
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

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const readAlias = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const optionFromValue = (value: unknown): MonitoringSelectorOption | null => {
  if (isMonitoringRecord(value)) {
    const rawValue = readMonitoringString(
      readAlias(value, 'value', 'key', 'id', 'name', 'hash', 'auth_index', 'authIndex')
    );
    if (!rawValue) return null;
    return {
      value: rawValue,
      label: readMonitoringString(readAlias(value, 'label', 'name', 'title')) || rawValue,
      count: readNumber(readAlias(value, 'count', 'total', 'total_calls', 'totalCalls')),
    };
  }

  const text = readMonitoringString(value);
  return text ? { value: text, label: text } : null;
};

const normalizeOptionList = (payload: unknown, key: string): MonitoringSelectorOption[] => {
  const seen = new Set<string>();
  return extractMonitoringArrayPayload(payload, key)
    .map(optionFromValue)
    .filter((option): option is MonitoringSelectorOption => Boolean(option))
    .filter((option) => {
      const identity = option.value.toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
};

export const normalizeMonitoringSelectors = (payload: unknown): MonitoringSelectorSet => {
  const record = isMonitoringRecord(payload) ? payload : {};
  const source = isMonitoringRecord(record.selectors)
    ? record.selectors
    : isMonitoringRecord(record.filter_options)
      ? record.filter_options
      : isMonitoringRecord(record.filterOptions)
        ? record.filterOptions
        : record;

  return {
    providers: normalizeOptionList(source.providers, 'providers'),
    models: normalizeOptionList(source.models, 'models'),
    accounts: normalizeOptionList(source.accounts, 'accounts'),
    authIndices: normalizeOptionList(
      source.authIndices ?? source.auth_indices ?? source.auth_indexes,
      'auth_indices'
    ),
    apiKeyHashes: normalizeOptionList(
      source.apiKeyHashes ?? source.api_key_hashes,
      'api_key_hashes'
    ),
    sourceHashes: normalizeOptionList(source.sourceHashes ?? source.source_hashes, 'source_hashes'),
    requestTypes: normalizeOptionList(source.requestTypes ?? source.request_types, 'request_types'),
    headerTraceIds: normalizeOptionList(
      source.headerTraceIds ?? source.header_trace_ids,
      'header_trace_ids'
    ),
  };
};

export const selectorsFromAnalytics = (
  analytics: MonitoringAnalyticsResponse | undefined
): MonitoringSelectorSet =>
  analytics?.filterOptions === undefined
    ? EMPTY_SELECTORS
    : normalizeMonitoringSelectors(analytics.filterOptions);
