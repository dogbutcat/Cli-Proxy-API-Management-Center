import type {
  MonitoringAnalyticsResponse,
  MonitoringEvent,
  UsageApiResult,
  UsageQueryStatus,
  UsageStatus,
  UsageSummaryMetrics,
} from '@/services/api/usageService';
import { deriveMonitoringSourceIdentity } from '@/features/monitoring/model/sourceDisplay';

export type UsageAnalyticsDataState =
  'idle' | 'loading' | 'refreshing' | 'ok' | 'empty' | 'unsupported' | 'error' | 'unavailable';

export type UsageAnalyticsPriceState = 'priced' | 'missing' | 'unknown';

export type UsageAnalyticsIssue = {
  source: 'analytics' | 'status' | 'comparison' | 'drilldown';
  kind?: string;
  message: string;
};

export type UsageAnalyticsFlags = {
  partial: boolean;
  stale: boolean;
  empty: boolean;
  unsupported: boolean;
  error: boolean;
  unavailable: boolean;
  zeroToken: boolean;
  missingPrice: boolean;
};

export type UsageAnalyticsStatRowKind =
  'model' | 'clientKey' | 'credential' | 'provider' | 'trend' | 'heatmap';

export type UsageAnalyticsSafeIdentity = {
  label: string;
  identityKey: string;
  provider: string;
  protocol: string;
  workspace: string;
  entry: string;
  safeQuery: Record<string, string>;
  unsafeFields: string[];
};

export type UsageAnalyticsStatRow = {
  kind: UsageAnalyticsStatRowKind;
  id: string;
  label: string;
  secondaryLabel: string;
  provider: string;
  calls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  totalCost: number | null;
  averageLatencyMs: number | null;
  zeroTokenCalls: number;
  missingPriceCalls: number;
  priceState: UsageAnalyticsPriceState;
  lastSeenAtMs: number | null;
  safeIdentity?: UsageAnalyticsSafeIdentity;
};

export type UsageAnalyticsTrendBucket = UsageAnalyticsStatRow & {
  bucketStartMs: number;
  bucketLabel: string;
};

export type UsageAnalyticsHeatmapCell = UsageAnalyticsStatRow & {
  day: number;
  hour: number;
};

export type UsageAnalyticsOverview = {
  summary: UsageSummaryMetrics | null;
  status: UsageQueryStatus | null;
  generatedAtMs: number | null;
  serviceStatus: UsageStatus | null;
};

export type UsageAnalyticsComparisonModel = {
  state: UsageAnalyticsDataState;
  reason: 'not_requested' | 'unavailable' | 'empty' | 'unsupported' | 'error' | 'ok';
  deltaCalls: number | null;
  deltaTokens: number | null;
  deltaCost: number | null;
  deltaSuccessRate: number | null;
};

export type UsageAnalyticsDrilldownModel = {
  state: UsageAnalyticsDataState;
  events: MonitoringEvent[];
  hasMore: boolean;
  nextBeforeMs: number | null;
  nextBeforeId: number | null;
};

export type UsageAnalyticsSurfaceState = {
  overview: UsageAnalyticsDataState;
  trend: UsageAnalyticsDataState;
  models: UsageAnalyticsDataState;
  clientKeys: UsageAnalyticsDataState;
  credentials: UsageAnalyticsDataState;
  heatmap: UsageAnalyticsDataState;
  providerUsage: UsageAnalyticsDataState;
  comparison: UsageAnalyticsDataState;
  drilldown: UsageAnalyticsDataState;
};

export type UsageAnalyticsModel = {
  state: UsageAnalyticsDataState;
  surfaces: UsageAnalyticsSurfaceState;
  flags: UsageAnalyticsFlags;
  issues: UsageAnalyticsIssue[];
  overview: UsageAnalyticsOverview;
  trend: UsageAnalyticsTrendBucket[];
  models: UsageAnalyticsStatRow[];
  clientKeys: UsageAnalyticsStatRow[];
  credentials: UsageAnalyticsStatRow[];
  heatmap: UsageAnalyticsHeatmapCell[];
  providerUsage: UsageAnalyticsStatRow[];
  comparison: UsageAnalyticsComparisonModel;
  drilldown: UsageAnalyticsDrilldownModel;
  updatedAtMs: number | null;
};

export type UsageAnalyticsModelInput = {
  analytics?: UsageApiResult<MonitoringAnalyticsResponse>;
  status?: UsageApiResult<UsageStatus>;
  comparison?: UsageApiResult<MonitoringAnalyticsResponse> | null;
  drilldown?: UsageApiResult<MonitoringAnalyticsResponse> | null;
  loading?: boolean;
  refreshing?: boolean;
  updatedAtMs?: number | null;
};

const EMPTY_FLAGS: UsageAnalyticsFlags = {
  partial: false,
  stale: false,
  empty: false,
  unsupported: false,
  error: false,
  unavailable: false,
  zeroToken: false,
  missingPrice: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readAlias = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const readString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const readNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  return readNumber(value);
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
  return false;
};

const readRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const hasAnyKey = (record: Record<string, unknown>, keys: string[]): boolean =>
  keys.some((key) => record[key] !== undefined);

const successLikeData = <T>(result: UsageApiResult<T> | null | undefined): T | null =>
  result?.kind === 'success' || result?.kind === 'empty' ? result.data : null;

const resultState = <T>(result: UsageApiResult<T> | null | undefined): UsageAnalyticsDataState => {
  if (!result) return 'idle';
  if (result.kind === 'success') return 'ok';
  if (result.kind === 'empty') return 'empty';
  if (result.kind === 'unsupported') return 'unsupported';
  return 'error';
};

const collectIssues = <T>(
  source: UsageAnalyticsIssue['source'],
  result: UsageApiResult<T> | null | undefined
): UsageAnalyticsIssue[] => {
  if (!result) return [];
  if (result.kind === 'error' || result.kind === 'unsupported') {
    return [{ source, kind: result.code, message: result.message }];
  }
  const status = result.status ?? (isRecord(result.data) ? undefined : undefined);
  return [...(status?.errors ?? []), ...(status?.warnings ?? [])].map((issue) => ({
    source,
    kind: issue.kind,
    message: issue.message ?? issue.kind ?? 'Usage API issue',
  }));
};

const statusFromResult = <T>(
  result: UsageApiResult<T> | null | undefined,
  dataStatus?: UsageQueryStatus
): UsageQueryStatus | undefined => {
  if (!result) return dataStatus;
  if (result.kind === 'success' || result.kind === 'empty') return result.status ?? dataStatus;
  if (result.kind === 'unsupported') return result.status;
  return undefined;
};

const readAggregateList = (
  analytics: MonitoringAnalyticsResponse | null,
  keys: string[]
): { state: UsageAnalyticsDataState; records: Record<string, unknown>[] } => {
  if (!analytics) return { state: 'idle', records: [] };
  const record = analytics as unknown as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined) {
      const records = readRecordArray(record[key]);
      return { state: records.length ? 'ok' : 'empty', records };
    }
  }
  return { state: 'unavailable', records: [] };
};

const rateFromCounts = (
  successCalls: number,
  calls: number,
  explicitRate: number | null
): number | null => {
  if (explicitRate !== null) return explicitRate;
  return calls > 0 ? (successCalls / calls) * 100 : null;
};

const aggregateRow = (
  raw: Record<string, unknown>,
  kind: UsageAnalyticsStatRowKind,
  index: number
): UsageAnalyticsStatRow => {
  const calls = readNumber(readAlias(raw, 'calls', 'total_calls', 'totalCalls', 'count'));
  const failureCalls = readNumber(readAlias(raw, 'failure_calls', 'failureCalls', 'failed_calls'));
  const successCalls = readNumber(
    readAlias(raw, 'success_calls', 'successCalls'),
    Math.max(0, calls - failureCalls)
  );
  const totalTokens = readNumber(readAlias(raw, 'total_tokens', 'totalTokens', 'tokens'));
  const totalCostValue = readAlias(raw, 'total_cost', 'totalCost', 'cost');
  const explicitPriceState = readString(readAlias(raw, 'price_state', 'priceState')).toLowerCase();
  const explicitMissingPrice =
    explicitPriceState.includes('missing') ||
    readBoolean(readAlias(raw, 'missing_price', 'missingPrice')) ||
    readNumber(readAlias(raw, 'missing_price_calls', 'missingPriceCalls')) > 0;
  const hasCost = totalCostValue !== undefined && totalCostValue !== null && totalCostValue !== '';
  const id =
    readString(
      readAlias(
        raw,
        'id',
        'model',
        'provider',
        'api_key_hash',
        'apiKeyHash',
        'credential_id',
        'credentialId',
        'auth_index',
        'authIndex',
        'source_hash',
        'sourceHash',
        'bucket',
        'bucket_start_ms',
        'bucketStartMs'
      )
    ) || `${kind}:${index}`;
  const label =
    readString(
      readAlias(
        raw,
        'label',
        'name',
        'model',
        'provider',
        'api_key_label',
        'apiKeyLabel',
        'api_key_hash',
        'apiKeyHash',
        'auth_label',
        'authLabel',
        'auth_index',
        'authIndex',
        'bucket_label',
        'bucketLabel'
      )
    ) || id;
  return {
    kind,
    id,
    label,
    secondaryLabel: readString(
      readAlias(
        raw,
        'secondary_label',
        'secondaryLabel',
        'workspace',
        'workspace_id',
        'workspaceId',
        'project_id',
        'projectId',
        'auth_file',
        'authFile'
      )
    ),
    provider: readString(readAlias(raw, 'provider', 'auth_provider', 'authProvider')),
    calls,
    successCalls,
    failureCalls,
    successRate: rateFromCounts(
      successCalls,
      calls,
      readNullableNumber(readAlias(raw, 'success_rate', 'successRate'))
    ),
    inputTokens: readNumber(readAlias(raw, 'input_tokens', 'inputTokens')),
    outputTokens: readNumber(readAlias(raw, 'output_tokens', 'outputTokens')),
    reasoningTokens: readNumber(readAlias(raw, 'reasoning_tokens', 'reasoningTokens')),
    cachedTokens: readNumber(readAlias(raw, 'cached_tokens', 'cachedTokens')),
    totalTokens,
    totalCost: hasCost ? readNumber(totalCostValue) : null,
    averageLatencyMs: readNullableNumber(readAlias(raw, 'average_latency_ms', 'averageLatencyMs')),
    zeroTokenCalls: readNumber(readAlias(raw, 'zero_token_calls', 'zeroTokenCalls')),
    missingPriceCalls: readNumber(readAlias(raw, 'missing_price_calls', 'missingPriceCalls')),
    priceState: explicitMissingPrice ? 'missing' : hasCost ? 'priced' : 'unknown',
    lastSeenAtMs: readNullableNumber(readAlias(raw, 'last_seen_at_ms', 'lastSeenAtMs')),
  };
};

const credentialRow = (raw: Record<string, unknown>, index: number): UsageAnalyticsStatRow => {
  const row = aggregateRow(raw, 'credential', index);
  const provider = row.provider || readString(readAlias(raw, 'provider', 'auth_provider'));
  const sourcePayload = readAlias(
    raw,
    'source_payload',
    'sourcePayload',
    'source_identity',
    'sourceIdentity'
  );
  const event: MonitoringEvent = {
    eventHash: '',
    timestampMs: row.lastSeenAtMs ?? 0,
    provider,
    model: '',
    endpoint: '',
    authIndex: readString(readAlias(raw, 'auth_index', 'authIndex')) || row.id,
    sourceHash: readString(readAlias(raw, 'source_hash', 'sourceHash')),
    accountSnapshot: '',
    authLabelSnapshot: readString(readAlias(raw, 'auth_label', 'authLabel', 'label')),
    authFileSnapshot: readString(readAlias(raw, 'auth_file', 'authFile')),
    authProviderSnapshot: provider,
    authProjectIdSnapshot: readString(readAlias(raw, 'project_id', 'projectId')),
    totalTokens: row.totalTokens,
    failed: false,
  };
  const source = deriveMonitoringSourceIdentity(event, null, sourcePayload);
  return {
    ...row,
    provider: source.provider || row.provider,
    label: source.label || row.label,
    secondaryLabel: readString(readAlias(raw, 'auth_file', 'authFile')),
    safeIdentity: source,
  };
};

const trendRow = (raw: Record<string, unknown>, index: number): UsageAnalyticsTrendBucket => {
  const row = aggregateRow(raw, 'trend', index);
  const bucketStartMs = readNumber(
    readAlias(raw, 'bucket_start_ms', 'bucketStartMs', 'from_ms', 'fromMs')
  );
  return {
    ...row,
    bucketStartMs,
    bucketLabel:
      readString(readAlias(raw, 'bucket_label', 'bucketLabel')) ||
      new Date(bucketStartMs).toLocaleString(),
  };
};

const heatmapCell = (raw: Record<string, unknown>, index: number): UsageAnalyticsHeatmapCell => ({
  ...aggregateRow(raw, 'heatmap', index),
  day: readNumber(readAlias(raw, 'day', 'weekday', 'dayOfWeek')),
  hour: readNumber(readAlias(raw, 'hour', 'hourOfDay')),
});

const surfaceState = (state: UsageAnalyticsDataState, rows: unknown[]): UsageAnalyticsDataState =>
  state === 'ok' && rows.length === 0 ? 'empty' : state;

const buildComparison = (
  current: MonitoringAnalyticsResponse | null,
  comparison: UsageApiResult<MonitoringAnalyticsResponse> | null | undefined
): UsageAnalyticsComparisonModel => {
  if (comparison === null || comparison === undefined) {
    return {
      state: 'unavailable',
      reason: 'not_requested',
      deltaCalls: null,
      deltaTokens: null,
      deltaCost: null,
      deltaSuccessRate: null,
    };
  }
  const state = resultState(comparison);
  const previous = successLikeData(comparison);
  if (state !== 'ok' && state !== 'empty') {
    return {
      state,
      reason: state === 'unsupported' ? 'unsupported' : 'error',
      deltaCalls: null,
      deltaTokens: null,
      deltaCost: null,
      deltaSuccessRate: null,
    };
  }
  if (!current?.summary || !previous?.summary) {
    return {
      state: 'unavailable',
      reason: state === 'empty' ? 'empty' : 'unavailable',
      deltaCalls: null,
      deltaTokens: null,
      deltaCost: null,
      deltaSuccessRate: null,
    };
  }
  return {
    state: 'ok',
    reason: 'ok',
    deltaCalls: current.summary.totalCalls - previous.summary.totalCalls,
    deltaTokens: current.summary.totalTokens - previous.summary.totalTokens,
    deltaCost: current.summary.totalCost - previous.summary.totalCost,
    deltaSuccessRate: current.summary.successRate - previous.summary.successRate,
  };
};

const buildDrilldown = (
  result: UsageApiResult<MonitoringAnalyticsResponse> | null | undefined
): UsageAnalyticsDrilldownModel => {
  if (result === null || result === undefined) {
    return {
      state: 'unavailable',
      events: [],
      hasMore: false,
      nextBeforeMs: null,
      nextBeforeId: null,
    };
  }
  const analytics = successLikeData(result);
  const events = analytics?.events;
  return {
    state: resultState(result),
    events: events?.items ?? [],
    hasMore: Boolean(events?.hasMore),
    nextBeforeMs: events?.nextBeforeMs ?? null,
    nextBeforeId: events?.nextBeforeId ?? null,
  };
};

const flagsFromRows = (
  ...groups: UsageAnalyticsStatRow[][]
): Pick<UsageAnalyticsFlags, 'zeroToken' | 'missingPrice'> => {
  const rows = groups.flat();
  return {
    zeroToken: rows.some(
      (row) => row.zeroTokenCalls > 0 || (row.calls > 0 && row.totalTokens === 0)
    ),
    missingPrice: rows.some((row) => row.priceState === 'missing'),
  };
};

export const buildUsageAnalyticsModel = (
  input: UsageAnalyticsModelInput = {}
): UsageAnalyticsModel => {
  const analytics = successLikeData(input.analytics);
  const statusData = successLikeData(input.status);
  const analyticsStatus =
    input.analytics?.kind === 'success' || input.analytics?.kind === 'empty'
      ? input.analytics.status
      : undefined;
  const queryStatus = statusFromResult(
    input.analytics,
    analytics?.summary ? analyticsStatus : undefined
  );
  const trendSource = readAggregateList(analytics, ['trend', 'trendStats', 'timeline', 'buckets']);
  const modelSource = readAggregateList(analytics, [
    'modelStats',
    'model_stats',
    'models',
    'topModels',
    'top_models',
    'model_usage',
  ]);
  const clientKeySource = readAggregateList(analytics, [
    'apiKeyStats',
    'clientKeyStats',
    'client_keys',
  ]);
  const credentialSource = readAggregateList(analytics, [
    'credentialStats',
    'accountStats',
    'accounts',
    'credentials',
  ]);
  const heatmapSource = readAggregateList(analytics, ['heatmap', 'hourlyHeatmap']);
  const providerSource = readAggregateList(analytics, [
    'providerStats',
    'provider_stats',
    'providers',
    'provider_usage',
  ]);
  const trend = trendSource.records.map(trendRow);
  const models = modelSource.records.map((row, index) => aggregateRow(row, 'model', index));
  const clientKeys = clientKeySource.records.map((row, index) =>
    aggregateRow(row, 'clientKey', index)
  );
  const credentials = credentialSource.records.map(credentialRow);
  const heatmap = heatmapSource.records.map(heatmapCell);
  const providerUsage = providerSource.records.map((row, index) =>
    aggregateRow(row, 'provider', index)
  );
  const comparison = buildComparison(analytics, input.comparison);
  const drilldown = buildDrilldown(input.drilldown);
  const topState = input.loading
    ? analytics
      ? 'refreshing'
      : 'loading'
    : input.analytics
      ? resultState(input.analytics)
      : 'idle';
  const rowFlags = flagsFromRows(trend, models, clientKeys, credentials, heatmap, providerUsage);
  const missingAggregates = [
    trendSource,
    modelSource,
    clientKeySource,
    credentialSource,
    heatmapSource,
    providerSource,
  ].some((source) => source.state === 'unavailable');
  const summaryEmpty =
    input.analytics?.kind === 'empty' ||
    queryStatus?.state === 'empty' ||
    (analytics?.summary !== undefined && analytics.summary.totalCalls === 0);
  const flags: UsageAnalyticsFlags = {
    ...EMPTY_FLAGS,
    partial: Boolean(queryStatus?.partial || statusData?.status?.partial),
    stale: Boolean(queryStatus?.stale || statusData?.status?.stale),
    empty: summaryEmpty,
    unsupported: topState === 'unsupported' || input.status?.kind === 'unsupported',
    error: topState === 'error' || input.status?.kind === 'error',
    unavailable: missingAggregates,
    zeroToken: rowFlags.zeroToken || Boolean(analytics?.summary?.zeroTokenCalls),
    missingPrice: rowFlags.missingPrice,
  };
  const surfaces: UsageAnalyticsSurfaceState = {
    overview: topState === 'ok' && summaryEmpty ? 'empty' : topState,
    trend: surfaceState(trendSource.state, trend),
    models: surfaceState(modelSource.state, models),
    clientKeys: surfaceState(clientKeySource.state, clientKeys),
    credentials: surfaceState(credentialSource.state, credentials),
    heatmap: surfaceState(heatmapSource.state, heatmap),
    providerUsage: surfaceState(providerSource.state, providerUsage),
    comparison: comparison.state,
    drilldown: drilldown.state,
  };
  return {
    state: topState,
    surfaces,
    flags,
    issues: [
      ...collectIssues('analytics', input.analytics),
      ...collectIssues('status', input.status),
      ...collectIssues('comparison', input.comparison),
      ...collectIssues('drilldown', input.drilldown),
    ],
    overview: {
      summary: analytics?.summary ?? null,
      status: queryStatus ?? null,
      generatedAtMs: analytics?.generatedAtMs ?? null,
      serviceStatus: statusData,
    },
    trend,
    models,
    clientKeys,
    credentials,
    heatmap,
    providerUsage,
    comparison,
    drilldown,
    updatedAtMs: input.updatedAtMs ?? null,
  };
};

export const usageAnalyticsHasAggregate = (
  analytics: MonitoringAnalyticsResponse,
  keys: string[]
): boolean => hasAnyKey(analytics as unknown as Record<string, unknown>, keys);
