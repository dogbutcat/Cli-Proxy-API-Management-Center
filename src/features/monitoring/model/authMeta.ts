import type { AuthFileItem } from '@/types/authFile';
import { normalizeAuthIndex } from '@/utils/authIndex';
import {
  extractMonitoringHost,
  isMonitoringRecord,
  parseMonitoringBoolean,
  readMonitoringString,
} from './base';
import type { MonitoringAuthMeta, MonitoringChannelMeta } from './types';

const readRecordString = (entry: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = readMonitoringString(entry[key]);
    if (value) return value;
  }
  return '';
};

const readAuthTimestamp = (entry: AuthFileItem): string =>
  readMonitoringString(
    entry.updatedAt ?? entry['updated_at'] ?? entry.modified ?? entry['modtime']
  );

export const normalizeOpenAIChannel = (
  value: unknown,
  index: number
): MonitoringChannelMeta | null => {
  if (!isMonitoringRecord(value)) return null;

  const name = readRecordString(value, ['name', 'id']) || `openai-${index + 1}`;
  const baseUrl = readMonitoringString(value.baseUrl ?? value['base-url']);
  if (!baseUrl) return null;

  const authIndices = new Set<string>();
  const providerAuthIndex = normalizeAuthIndex(
    value.authIndex ?? value['auth-index'] ?? value['auth_index']
  );
  if (providerAuthIndex) authIndices.add(providerAuthIndex);

  const apiKeyEntries = Array.isArray(value['api-key-entries']) ? value['api-key-entries'] : [];
  apiKeyEntries.forEach((entry) => {
    if (!isMonitoringRecord(entry)) return;
    const authIndex = normalizeAuthIndex(
      entry.authIndex ?? entry['auth-index'] ?? entry['auth_index']
    );
    if (authIndex) authIndices.add(authIndex);
  });

  const modelNames = Array.isArray(value.models)
    ? value.models
        .map((item) => {
          if (typeof item === 'string') return readMonitoringString(item);
          if (!isMonitoringRecord(item)) return '';
          return readRecordString(item, ['name', 'alias', 'id', 'model']);
        })
        .filter(Boolean)
    : [];

  return {
    key: `${name}:${index}`,
    name,
    baseUrl,
    host: extractMonitoringHost(baseUrl),
    disabled: parseMonitoringBoolean(value.disabled),
    authIndices: Array.from(authIndices),
    modelNames: Array.from(new Set(modelNames)),
  };
};

export const normalizeMonitoringAuthMeta = (entry: AuthFileItem): MonitoringAuthMeta | null => {
  const authIndex = normalizeAuthIndex(entry.authIndex ?? entry.auth_index ?? entry['auth-index']);
  if (!authIndex) return null;

  const record = entry as Record<string, unknown>;
  const idToken = isMonitoringRecord(entry.id_token) ? entry.id_token : {};
  const label =
    readRecordString(record, [
      'displayName',
      'display_name',
      'label',
      'name',
      'email',
      'account',
    ]) || authIndex;
  const planType =
    readRecordString(idToken, ['planType', 'plan_type']) ||
    readRecordString(record, ['planType', 'plan_type']) ||
    '-';

  return {
    authIndex,
    label,
    generatedName: readRecordString(record, [
      'generatedName',
      'generated_name',
      'opencodeGoEntryName',
      'opencode_go_entry_name',
    ]),
    protocol: readRecordString(record, ['protocol']),
    keyName: readRecordString(record, ['keyName', 'key_name']),
    account: readRecordString(record, ['account', 'email']) || label,
    provider: readRecordString(record, ['provider', 'type']) || '-',
    status: readRecordString(record, ['status']) || 'unknown',
    disabled: parseMonitoringBoolean(entry.disabled),
    unavailable: parseMonitoringBoolean(entry.unavailable),
    runtimeOnly: parseMonitoringBoolean(entry.runtimeOnly ?? entry.runtime_only),
    planType,
    updatedAt: readAuthTimestamp(entry),
  };
};

export const buildMonitoringAuthMetaMap = (
  authFiles: AuthFileItem[]
): Map<string, MonitoringAuthMeta> => {
  const map = new Map<string, MonitoringAuthMeta>();
  authFiles.forEach((entry) => {
    const normalized = normalizeMonitoringAuthMeta(entry);
    if (!normalized) return;
    map.set(normalized.authIndex, normalized);
  });
  return map;
};
