import type { MonitoringAnalyticsFilterOptions } from '@/services/api/usageService';
import type { CredentialInfo } from '@/types/sourceInfo';
import { buildSourceInfoMap } from '@/utils/sourceResolver';
import { formatApiKeyHashLabel, maskEmailLike, readString } from './base';
import { sanitizeApiKeyDisplayText, type ApiKeyDisplayInfo } from './apiKeys';
import {
  buildFilterOptionsFromAnalytics,
  buildMonitoringAccountFilterValue,
} from './analyticsAdapters';
import type {
  MonitoringAccountRow,
  MonitoringApiKeyRow,
  MonitoringAuthMeta,
  MonitoringChannelMeta,
  MonitoringFilterOptions,
} from './types';

const uniqueReadableValues = (values: Array<string | null | undefined> = []) =>
  Array.from(new Set(values.map(readString).filter((value) => value && value !== '-'))).sort();

const normalizeProviderType = (value: string | null | undefined): string => {
  const trimmed = readString(value).trim().toLowerCase();
  return trimmed.startsWith('openai-compatible-') ? 'openai-compatible' : trimmed;
};

const normalizeApiKeyHashValues = (values: Array<string | null | undefined> = []) =>
  uniqueReadableValues(values).map((value) => value.toLowerCase());

const normalizeFilterText = (value: string | null | undefined) =>
  readString(value).trim().toLowerCase();

const buildSelectorAccountRowsFromValues = (
  accounts: Array<string | null | undefined> = []
): MonitoringAccountRow[] =>
  uniqueReadableValues(accounts).map((account) => ({
    id: `account:${account}`,
    account,
    filterValue: buildMonitoringAccountFilterValue({ account }),
    displayAccount: account,
    accountMasked: maskEmailLike(account),
    authLabels: [],
    authIndices: [],
    sourceKeys: [],
    channels: [],
    totalCalls: 0,
    successCalls: 0,
    failureCalls: 0,
    successRate: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    averageLatencyMs: null,
    lastSeenAt: 0,
    recentPattern: [],
    models: [],
  }));

const buildSelectorApiKeyRowsFromValues = (
  apiKeyHashes: Array<string | null | undefined> = [],
  apiKeyDisplayMap: Map<string, ApiKeyDisplayInfo>
): MonitoringApiKeyRow[] =>
  normalizeApiKeyHashValues(apiKeyHashes).map((apiKeyHash) => {
    const apiKeyDisplay = apiKeyDisplayMap.get(apiKeyHash);
    const fallbackApiKeyLabel = formatApiKeyHashLabel(apiKeyHash);
    const apiKeyLabel = sanitizeApiKeyDisplayText(
      apiKeyDisplay?.label || fallbackApiKeyLabel,
      fallbackApiKeyLabel
    );
    const apiKeyMasked = sanitizeApiKeyDisplayText(
      apiKeyDisplay?.masked || apiKeyLabel,
      apiKeyLabel
    );
    return {
      id: apiKeyHash,
      apiKeyHash,
      apiKeyLabel,
      apiKeyMasked,
      rawApiKey: apiKeyDisplay?.rawKey,
      isUnknown: false,
      authLabels: [],
      sourceLabels: [],
      channels: [],
      totalCalls: 0,
      successCalls: 0,
      failureCalls: 0,
      successRate: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatencyMs: null,
      lastSeenAt: 0,
      models: [],
    };
  });

const mergeSelectorAccountRows = (
  rows: MonitoringAccountRow[],
  accounts: Array<string | null | undefined> = []
) => {
  const seen = new Set(rows.map((row) => normalizeFilterText(row.account || row.displayAccount)));
  const extraRows = buildSelectorAccountRowsFromValues(accounts).filter((row) => {
    const key = normalizeFilterText(row.account || row.displayAccount);
    return key && !seen.has(key);
  });
  return [...rows, ...extraRows];
};

const mergeSelectorApiKeyRows = (
  rows: MonitoringApiKeyRow[],
  apiKeyHashes: Array<string | null | undefined> = [],
  apiKeyDisplayMap: Map<string, ApiKeyDisplayInfo>
) => {
  const seen = new Set(rows.map((row) => normalizeFilterText(row.apiKeyHash)));
  const extraRows = buildSelectorApiKeyRowsFromValues(apiKeyHashes, apiKeyDisplayMap).filter(
    (row) => {
      const key = normalizeFilterText(row.apiKeyHash);
      return key && !seen.has(key);
    }
  );
  return [...rows, ...extraRows];
};

export const buildFilterOptionsFromSelector = (
  options: MonitoringAnalyticsFilterOptions | undefined,
  authMetaMap: Map<string, MonitoringAuthMeta>,
  authFileMap: Map<string, CredentialInfo>,
  sourceInfoMap: ReturnType<typeof buildSourceInfoMap>,
  channelByAuthIndex: Map<string, MonitoringChannelMeta>,
  apiKeyDisplayMap: Map<string, ApiKeyDisplayInfo>
): MonitoringFilterOptions => {
  const base = buildFilterOptionsFromAnalytics(
    options,
    authMetaMap,
    authFileMap,
    sourceInfoMap,
    channelByAuthIndex,
    apiKeyDisplayMap
  );
  if (!options) return base;

  const accountRows = mergeSelectorAccountRows(base.accountRows, options.accounts);
  const apiKeyRows = mergeSelectorApiKeyRows(
    base.apiKeyRows,
    options.api_key_hashes,
    apiKeyDisplayMap
  );

  return {
    ...base,
    accountRows,
    apiKeyRows,
    providers: uniqueReadableValues([
      ...base.providers,
      ...(options.providers || []).map(normalizeProviderType),
    ]),
    models: uniqueReadableValues([
      ...base.models,
      ...(options.models || []),
      ...accountRows.flatMap((row) => row.models.map((model) => model.model)),
      ...apiKeyRows.flatMap((row) => row.models.map((model) => model.model)),
    ]),
  };
};
