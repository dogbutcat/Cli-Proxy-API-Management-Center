import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export const USAGE_API_TIMEOUT_MS = 30 * 1000;
export const USAGE_API_TRANSFER_TIMEOUT_MS = 60 * 1000;

export type UsageCapabilityState = 'supported' | 'unsupported' | 'unknown';
export type UsageDataState = 'ok' | 'empty' | 'unsupported' | 'error' | 'unavailable' | string;

export type UsageApiIssue = {
  component?: string;
  kind?: string;
  message?: string;
};

export type UsageQueryStatus = {
  state: UsageDataState;
  hasData: boolean;
  partial: boolean;
  stale: boolean;
  errors: UsageApiIssue[];
  warnings: UsageApiIssue[];
};

export type UsageApiSuccess<T> = {
  kind: 'success';
  data: T;
  status?: UsageQueryStatus;
};

export type UsageApiEmpty<T> = {
  kind: 'empty';
  data: T;
  status: UsageQueryStatus;
};

export type UsageApiUnsupported = {
  kind: 'unsupported';
  message: string;
  code?: string;
  status?: UsageQueryStatus;
  capabilities?: UsageCapabilities;
};

export type UsageApiError = {
  kind: 'error';
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type UsageApiResult<T> =
  UsageApiSuccess<T> | UsageApiEmpty<T> | UsageApiUnsupported | UsageApiError;

export type WireUsageQueryStatus = {
  state?: unknown;
  has_data?: unknown;
  hasData?: unknown;
  partial?: unknown;
  stale?: unknown;
  errors?: unknown;
  warnings?: unknown;
  [key: string]: unknown;
};

export type WireUsageErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  unsupported?: unknown;
  status?: unknown;
  capabilities?: unknown;
  [key: string]: unknown;
};

export type UsageCapability = {
  supported: boolean;
  reason?: string;
  version?: string;
  state: UsageCapabilityState;
};

export type UsageCapabilities = {
  source?: string;
  schemaVersion: number;
  accountActions: UsageCapability;
};

export type WireUsageCapabilities = {
  source?: unknown;
  schema_version?: unknown;
  schemaVersion?: unknown;
  account_actions?: unknown;
  accountActions?: unknown;
  [key: string]: unknown;
};

export type UsageStatus = {
  service?: string;
  source?: string;
  events: number;
  deadLetters: number;
  dbPath?: string;
  dbSizeBytes: number;
  status?: UsageQueryStatus;
  collector?: {
    collector?: string;
    mode?: string;
    queueSize: number;
    totalInserted: number;
    totalDropped: number;
    totalSkipped: number;
    lastInsertedAt: number;
    lastError?: string;
  };
};

export type DashboardSummaryParams = {
  todayStartMs: number;
  nowMs?: number;
  topModels?: number;
  recentFailures?: number;
};

export type DashboardSummary = {
  generatedAtMs: number;
  status?: UsageQueryStatus;
  window: {
    todayStartMs: number;
    nowMs: number;
    rolling30mStartMs: number;
  };
  today: UsageSummaryMetrics;
  rolling30m: {
    rpm: number;
    tpm: number;
    totalCalls: number;
    totalTokens: number;
  };
  topModelsToday: Array<{
    model: string;
    calls: number;
    tokens: number;
    cost: number;
    successRate: number;
  }>;
  recentFailures: MonitoringEvent[];
};

export type UsageSummaryMetrics = {
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number | null;
  zeroTokenCalls: number;
};

export type MonitoringAnalyticsFilters = {
  models?: string[];
  providers?: string[];
  accounts?: string[];
  credentialIds?: string[];
  authFiles?: string[];
  authIndices?: string[];
  apiKeyHashes?: string[];
  sourceHashes?: string[];
  projectIds?: string[];
  requestTypes?: string[];
  headerErrorKinds?: string[];
  headerErrorCodes?: string[];
  headerQuotaPlans?: string[];
  headerTraceIds?: string[];
  includeFailed?: boolean;
  failedOnly?: boolean;
  minLatencyMs?: number;
  cacheStatus?: string;
};

export type MonitoringAnalyticsInclude = {
  summary?: boolean;
  summaryProfile?: 'compact' | 'full' | string;
  accountStats?: boolean;
  apiKeyStats?: boolean;
  filterOptions?: boolean;
  filterSelectors?: boolean;
  recentFailures?: number;
  eventsPage?: {
    limit?: number;
    beforeMs?: number | null;
    beforeId?: number | null;
  };
  granularity?: 'hour' | 'day' | string;
};

export type MonitoringAnalyticsRequest = {
  fromMs: number;
  toMs: number;
  nowMs?: number;
  timeZone?: string;
  searchQuery?: string;
  searchApiKeyHash?: string;
  filters?: MonitoringAnalyticsFilters;
  include?: MonitoringAnalyticsInclude;
};

export type WireMonitoringAnalyticsRequest = {
  from_ms: number;
  to_ms: number;
  now_ms?: number;
  time_zone?: string;
  search_query?: string;
  search_api_key_hash?: string;
  filters?: {
    models?: string[];
    providers?: string[];
    accounts?: string[];
    credential_ids?: string[];
    auth_files?: string[];
    auth_indices?: string[];
    api_key_hashes?: string[];
    source_hashes?: string[];
    project_ids?: string[];
    request_types?: string[];
    header_error_kinds?: string[];
    header_error_codes?: string[];
    header_quota_plans?: string[];
    header_trace_ids?: string[];
    include_failed?: boolean;
    failed_only?: boolean;
    min_latency_ms?: number;
    cache_status?: string;
  };
  include?: {
    summary?: boolean;
    summary_profile?: string;
    account_stats?: boolean;
    api_key_stats?: boolean;
    filter_options?: boolean;
    filter_selectors?: boolean;
    recent_failures?: number;
    events_page?: {
      limit?: number;
      before_ms?: number | null;
      before_id?: number | null;
    };
    granularity?: string;
  };
};

export type MonitoringEvent = {
  id?: number;
  requestId?: string;
  eventHash: string;
  timestampMs: number;
  provider?: string;
  model: string;
  resolvedModel?: string;
  endpoint: string;
  method?: string;
  path?: string;
  authIndex: string;
  source?: string;
  sourceHash: string;
  apiKeyHash?: string;
  accountSnapshot?: string;
  authLabelSnapshot?: string;
  authFileSnapshot?: string;
  authProviderSnapshot?: string;
  authProjectIdSnapshot?: string;
  totalTokens: number;
  failed: boolean;
  failStatusCode?: number | null;
  failSummary?: string;
  latencyMs?: number | null;
  headerTraceId?: string;
};

export type MonitoringEventsPage = {
  items: MonitoringEvent[];
  nextCursor: string | null;
  nextBeforeMs: number | null;
  nextBeforeId: number | null;
  hasMore: boolean;
  totalCount?: number | null;
};

export type MonitoringAnalyticsResponse = {
  generatedAtMs: number;
  granularity: string;
  summary?: UsageSummaryMetrics;
  accountStats?: unknown[];
  apiKeyStats?: unknown[];
  filterOptions?: unknown;
  events?: MonitoringEventsPage;
  recentFailures?: MonitoringEvent[];
};

export type MonitoringListParams = {
  fromMs?: number;
  toMs?: number;
  provider?: string;
  account?: string;
  requestType?: string;
  search?: string;
  cacheStatus?: string;
  failed?: boolean | 'all';
  limit?: number;
  cursor?: string;
  include?: Array<'compact' | 'full' | 'selectors' | 'events' | 'no-events' | 'options'>;
};

export type ModelPrice = {
  input?: number;
  output?: number;
  cached?: number;
  cacheRead?: number;
  cacheCreation?: number;
  currency?: string;
  unit?: number;
  [key: string]: unknown;
};

export type ModelPricesResponse = {
  prices: Record<string, ModelPrice>;
};

export type ModelPriceUsageSummaryResponse = {
  sampledEvents: number;
  totalEvents: number;
  truncated: boolean;
  models: Array<{
    model: string;
    calls: number;
    requestedCalls: number;
    resolvedCalls: number;
  }>;
};

export type ModelPriceSyncResponse = ModelPricesResponse & {
  source?: string;
  sources?: string[];
  imported: number;
  skipped: number;
  matched?: Record<string, ModelPrice>;
  candidates?: unknown[];
  unmatched?: string[];
  proxyUsed?: boolean;
  sourceResults?: unknown[];
};

export type AccountActionType = 'delete' | 'reauth' | 'review' | string;
export type AccountActionStatus = 'pending' | 'ignored' | 'resolved' | 'deleted' | string;

export type AccountActionCandidate = {
  id: number;
  actionType: AccountActionType;
  status: AccountActionStatus;
  provider?: string;
  authFileName: string;
  authIndex?: string;
  authLabel?: string;
  reason: string;
  evidence?: unknown;
  lastError?: string;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
  hitCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type AccountActionCandidatesResponse = {
  items: AccountActionCandidate[];
  pendingCount: number;
};

export type UsageImportResponse = {
  format?: string;
  added: number;
  skipped: number;
  total: number;
  failed: number;
  unsupported?: number;
  warnings?: string[];
};

export type UsageImportSessionStatus =
  'uploading' | 'ready' | 'processing' | 'completed' | 'cancelled' | 'failed' | string;

export type UsageImportSession = {
  id: string;
  filename: string;
  status: UsageImportSessionStatus;
  sizeBytes: number;
  receivedBytes: number;
  chunkSizeBytes: number;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  retryable: boolean;
  error?: string;
  result?: UsageImportResponse | Record<string, unknown>;
};

export type UsageImportSessionCreateRequest = {
  filename: string;
  sizeBytes: number;
  resumeKey?: string;
};

export type WireUsageImportSessionCreateRequest = {
  filename: string;
  size_bytes: number;
  resume_key?: string;
};

export type WireUsageImportSession = {
  id?: unknown;
  filename?: unknown;
  status?: unknown;
  size_bytes?: unknown;
  sizeBytes?: unknown;
  received_bytes?: unknown;
  receivedBytes?: unknown;
  chunk_size_bytes?: unknown;
  chunkSizeBytes?: unknown;
  created_at_ms?: unknown;
  createdAtMs?: unknown;
  updated_at_ms?: unknown;
  updatedAtMs?: unknown;
  expires_at_ms?: unknown;
  expiresAtMs?: unknown;
  retryable?: unknown;
  error?: unknown;
  result?: unknown;
  resume_key?: unknown;
  resumeKey?: unknown;
  [key: string]: unknown;
};

const readString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const readNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  return readNumber(value);
};

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return fallback;
};

const readArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readRecordArray = (value: unknown): Record<string, unknown>[] =>
  readArray(value).filter(isRecord);

const readAlias = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const maybeSet = (target: Record<string, unknown>, key: string, value: unknown) => {
  if (value !== undefined) {
    target[key] = value;
  }
};

export const serializeDashboardSummaryParams = (
  params: DashboardSummaryParams
): Record<string, number> => {
  const query: Record<string, number> = {
    today_start_ms: params.todayStartMs,
  };
  maybeSet(query, 'now_ms', params.nowMs);
  maybeSet(query, 'top_models', params.topModels);
  maybeSet(query, 'recent_failures', params.recentFailures);
  return query;
};

export const serializeMonitoringListParams = (
  params: MonitoringListParams = {}
): Record<string, string | number | boolean> => {
  const query: Record<string, string | number | boolean> = {};
  maybeSet(query, 'from_ms', params.fromMs);
  maybeSet(query, 'to_ms', params.toMs);
  maybeSet(query, 'provider', params.provider);
  maybeSet(query, 'account', params.account);
  maybeSet(query, 'request_type', params.requestType);
  maybeSet(query, 'search', params.search);
  maybeSet(query, 'cache_status', params.cacheStatus);
  maybeSet(query, 'limit', params.limit);
  maybeSet(query, 'cursor', params.cursor);
  if (params.failed !== undefined) {
    query.failed = params.failed === 'all' ? 'all' : params.failed;
  }
  if (params.include?.length) {
    query.include = params.include.join(',');
  }
  return query;
};

export const buildCompactMonitoringAnalyticsInclude = (
  eventsPage?: MonitoringAnalyticsInclude['eventsPage'],
  granularity: string = 'hour'
): MonitoringAnalyticsInclude => ({
  summary: true,
  summaryProfile: 'compact',
  accountStats: true,
  apiKeyStats: true,
  eventsPage,
  granularity,
});

export const serializeMonitoringAnalyticsRequest = (
  request: MonitoringAnalyticsRequest
): WireMonitoringAnalyticsRequest => {
  const filters = request.filters;
  const include = request.include;
  const wire: WireMonitoringAnalyticsRequest = {
    from_ms: request.fromMs,
    to_ms: request.toMs,
  };
  maybeSet(wire, 'now_ms', request.nowMs);
  maybeSet(wire, 'time_zone', request.timeZone);
  maybeSet(wire, 'search_query', request.searchQuery);
  maybeSet(wire, 'search_api_key_hash', request.searchApiKeyHash);
  if (filters) {
    wire.filters = {};
    maybeSet(wire.filters, 'models', filters.models);
    maybeSet(wire.filters, 'providers', filters.providers);
    maybeSet(wire.filters, 'accounts', filters.accounts);
    maybeSet(wire.filters, 'credential_ids', filters.credentialIds);
    maybeSet(wire.filters, 'auth_files', filters.authFiles);
    maybeSet(wire.filters, 'auth_indices', filters.authIndices);
    maybeSet(wire.filters, 'api_key_hashes', filters.apiKeyHashes);
    maybeSet(wire.filters, 'source_hashes', filters.sourceHashes);
    maybeSet(wire.filters, 'project_ids', filters.projectIds);
    maybeSet(wire.filters, 'request_types', filters.requestTypes);
    maybeSet(wire.filters, 'header_error_kinds', filters.headerErrorKinds);
    maybeSet(wire.filters, 'header_error_codes', filters.headerErrorCodes);
    maybeSet(wire.filters, 'header_quota_plans', filters.headerQuotaPlans);
    maybeSet(wire.filters, 'header_trace_ids', filters.headerTraceIds);
    maybeSet(wire.filters, 'include_failed', filters.includeFailed);
    maybeSet(wire.filters, 'failed_only', filters.failedOnly);
    maybeSet(wire.filters, 'min_latency_ms', filters.minLatencyMs);
    maybeSet(wire.filters, 'cache_status', filters.cacheStatus);
  }
  if (include) {
    wire.include = {};
    maybeSet(wire.include, 'summary', include.summary);
    maybeSet(wire.include, 'summary_profile', include.summaryProfile);
    maybeSet(wire.include, 'account_stats', include.accountStats);
    maybeSet(wire.include, 'api_key_stats', include.apiKeyStats);
    maybeSet(wire.include, 'filter_options', include.filterOptions);
    maybeSet(wire.include, 'filter_selectors', include.filterSelectors);
    maybeSet(wire.include, 'recent_failures', include.recentFailures);
    maybeSet(wire.include, 'granularity', include.granularity);
    if (include.eventsPage) {
      wire.include.events_page = {
        limit: include.eventsPage.limit,
        before_ms: include.eventsPage.beforeMs ?? null,
        before_id: include.eventsPage.beforeId ?? null,
      };
    }
  }
  return wire;
};

export const serializeUsageImportSessionCreateRequest = (
  request: UsageImportSessionCreateRequest
): WireUsageImportSessionCreateRequest => {
  const wire: WireUsageImportSessionCreateRequest = {
    filename: request.filename,
    size_bytes: request.sizeBytes,
  };
  maybeSet(wire, 'resume_key', request.resumeKey);
  return wire;
};

export const normalizeUsageStatus = (raw: unknown): UsageQueryStatus | undefined => {
  if (!isRecord(raw)) return undefined;
  const state = readString(raw.state) ?? 'ok';
  return {
    state,
    hasData: readBoolean(readAlias(raw, 'has_data', 'hasData'), state === 'ok'),
    partial: readBoolean(raw.partial),
    stale: readBoolean(raw.stale),
    errors: readRecordArray(raw.errors).map((item) => ({
      component: readString(item.component),
      kind: readString(item.kind),
      message: readString(item.message),
    })),
    warnings: readRecordArray(raw.warnings).map((item) => ({
      component: readString(item.component),
      kind: readString(item.kind),
      message: readString(item.message),
    })),
  };
};

const normalizeCapability = (raw: unknown): UsageCapability => {
  const record = isRecord(raw) ? raw : {};
  const supported = readBoolean(record.supported);
  return {
    supported,
    reason: readString(record.reason),
    version: readString(record.version),
    state: supported ? 'supported' : 'unsupported',
  };
};

export const normalizeUsageCapabilities = (raw: unknown): UsageCapabilities => {
  const record = isRecord(raw) ? raw : {};
  return {
    source: readString(record.source),
    schemaVersion: readNumber(readAlias(record, 'schema_version', 'schemaVersion'), 1),
    accountActions: normalizeCapability(readAlias(record, 'account_actions', 'accountActions')),
  };
};

export const normalizeUsageApiResult = <T>(
  raw: unknown,
  normalizeData: (payload: unknown) => T
): UsageApiResult<T> => {
  const record = isRecord(raw) ? raw : {};
  const status = normalizeUsageStatus(record.status ?? record.query_status ?? record.data_status);
  const unsupported = readBoolean(record.unsupported) || status?.state === 'unsupported';
  const errorMessage = readString(record.error) ?? readString(record.message);
  const code = readString(record.code);

  if (unsupported) {
    return {
      kind: 'unsupported',
      message: errorMessage ?? 'Usage API capability is unsupported.',
      code,
      status,
      capabilities: record.capabilities
        ? normalizeUsageCapabilities(record.capabilities)
        : undefined,
    };
  }
  if (errorMessage) {
    return { kind: 'error', message: errorMessage, code, details: raw };
  }

  const data = normalizeData(raw);
  if (status?.state === 'empty') {
    return { kind: 'empty', data, status };
  }
  return status ? { kind: 'success', data, status } : { kind: 'success', data };
};

export const normalizeUsageApiError = (error: unknown): UsageApiError | UsageApiUnsupported => {
  const record = isRecord(error) ? error : {};
  const details = record.data ?? record.details;
  if (isRecord(details)) {
    const envelope = normalizeUsageApiResult(details, (payload) => payload);
    if (envelope.kind === 'unsupported') return envelope;
  }
  return {
    kind: 'error',
    message:
      error instanceof Error
        ? error.message
        : (readString(record.message) ?? 'Usage API request failed.'),
    code: readString(record.code) ?? readString(record.apiCode),
    status: typeof record.status === 'number' ? record.status : undefined,
    details,
  };
};

const requestUsageApiResult = async <T>(
  operation: () => Promise<unknown>,
  normalizeData: (payload: unknown) => T
): Promise<UsageApiResult<T>> => {
  try {
    return normalizeUsageApiResult(await operation(), normalizeData);
  } catch (error) {
    return normalizeUsageApiError(error);
  }
};

const normalizeMetrics = (raw: unknown): UsageSummaryMetrics => {
  const record = isRecord(raw) ? raw : {};
  return {
    totalCalls: readNumber(readAlias(record, 'total_calls', 'totalCalls')),
    successCalls: readNumber(readAlias(record, 'success_calls', 'successCalls')),
    failureCalls: readNumber(readAlias(record, 'failure_calls', 'failureCalls')),
    successRate: readNumber(readAlias(record, 'success_rate', 'successRate')),
    inputTokens: readNumber(readAlias(record, 'input_tokens', 'inputTokens')),
    outputTokens: readNumber(readAlias(record, 'output_tokens', 'outputTokens')),
    reasoningTokens: readNumber(readAlias(record, 'reasoning_tokens', 'reasoningTokens')),
    cachedTokens: readNumber(readAlias(record, 'cached_tokens', 'cachedTokens')),
    cacheReadTokens: readNumber(readAlias(record, 'cache_read_tokens', 'cacheReadTokens')),
    cacheCreationTokens: readNumber(
      readAlias(record, 'cache_creation_tokens', 'cacheCreationTokens', 'cache_write_tokens')
    ),
    totalTokens: readNumber(readAlias(record, 'total_tokens', 'totalTokens')),
    totalCost: readNumber(readAlias(record, 'total_cost', 'totalCost')),
    averageLatencyMs: readNullableNumber(
      readAlias(record, 'average_latency_ms', 'averageLatencyMs', 'avgLatencyMs')
    ),
    zeroTokenCalls: readNumber(readAlias(record, 'zero_token_calls', 'zeroTokenCalls')),
  };
};

export const normalizeMonitoringEvent = (raw: unknown): MonitoringEvent => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNullableNumber(record.id) ?? undefined,
    requestId: readString(readAlias(record, 'request_id', 'requestId')),
    eventHash: readString(readAlias(record, 'event_hash', 'eventHash')) ?? '',
    timestampMs: readNumber(readAlias(record, 'timestamp_ms', 'timestampMs')),
    provider: readString(record.provider),
    model: readString(record.model) ?? '',
    resolvedModel: readString(readAlias(record, 'resolved_model', 'resolvedModel')),
    endpoint: readString(record.endpoint) ?? '',
    method: readString(record.method),
    path: readString(record.path),
    authIndex: readString(readAlias(record, 'auth_index', 'authIndex')) ?? '',
    source: readString(record.source),
    sourceHash: readString(readAlias(record, 'source_hash', 'sourceHash')) ?? '',
    apiKeyHash: readString(readAlias(record, 'api_key_hash', 'apiKeyHash')),
    accountSnapshot: readString(readAlias(record, 'account_snapshot', 'accountSnapshot')),
    authLabelSnapshot: readString(readAlias(record, 'auth_label_snapshot', 'authLabelSnapshot')),
    authFileSnapshot: readString(readAlias(record, 'auth_file_snapshot', 'authFileSnapshot')),
    authProviderSnapshot: readString(
      readAlias(record, 'auth_provider_snapshot', 'authProviderSnapshot')
    ),
    authProjectIdSnapshot: readString(
      readAlias(record, 'auth_project_id_snapshot', 'authProjectIdSnapshot')
    ),
    totalTokens: readNumber(readAlias(record, 'total_tokens', 'totalTokens')),
    failed: readBoolean(record.failed),
    failStatusCode: readNullableNumber(readAlias(record, 'fail_status_code', 'failStatusCode')),
    failSummary: readString(readAlias(record, 'fail_summary', 'failSummary')),
    latencyMs: readNullableNumber(readAlias(record, 'latency_ms', 'latencyMs')),
    headerTraceId: readString(readAlias(record, 'header_trace_id', 'headerTraceId')),
  };
};

export const normalizeMonitoringEventsPage = (raw: unknown): MonitoringEventsPage => {
  const record = isRecord(raw) ? raw : {};
  const items = readArray(record.items ?? record.events).map(normalizeMonitoringEvent);
  return {
    items,
    nextCursor: readString(readAlias(record, 'next_cursor', 'nextCursor')) ?? null,
    nextBeforeMs: readNullableNumber(readAlias(record, 'next_before_ms', 'nextBeforeMs')),
    nextBeforeId: readNullableNumber(readAlias(record, 'next_before_id', 'nextBeforeId')),
    hasMore: readBoolean(readAlias(record, 'has_more', 'hasMore')),
    totalCount:
      readAlias(record, 'total_count', 'totalCount') === undefined
        ? undefined
        : readNullableNumber(readAlias(record, 'total_count', 'totalCount')),
  };
};

export const normalizeDashboardSummary = (raw: unknown): DashboardSummary => {
  const record = isRecord(raw) ? raw : {};
  const windowRecord = isRecord(record.window) ? record.window : {};
  const rollingRecord = isRecord(readAlias(record, 'rolling_30m', 'rolling30m'))
    ? (readAlias(record, 'rolling_30m', 'rolling30m') as Record<string, unknown>)
    : {};
  return {
    generatedAtMs: readNumber(readAlias(record, 'generated_at_ms', 'generatedAtMs')),
    status: normalizeUsageStatus(record.status ?? record.query_status ?? record.data_status),
    window: {
      todayStartMs: readNumber(readAlias(windowRecord, 'today_start_ms', 'todayStartMs')),
      nowMs: readNumber(readAlias(windowRecord, 'now_ms', 'nowMs')),
      rolling30mStartMs: readNumber(
        readAlias(windowRecord, 'rolling_30m_start_ms', 'rolling30mStartMs')
      ),
    },
    today: normalizeMetrics(record.today),
    rolling30m: {
      rpm: readNumber(rollingRecord.rpm),
      tpm: readNumber(rollingRecord.tpm),
      totalCalls: readNumber(readAlias(rollingRecord, 'total_calls', 'totalCalls')),
      totalTokens: readNumber(readAlias(rollingRecord, 'total_tokens', 'totalTokens')),
    },
    topModelsToday: readRecordArray(readAlias(record, 'top_models_today', 'topModelsToday')).map(
      (item) => ({
        model: readString(item.model) ?? '',
        calls: readNumber(item.calls),
        tokens: readNumber(item.tokens),
        cost: readNumber(item.cost),
        successRate: readNumber(readAlias(item, 'success_rate', 'successRate')),
      })
    ),
    recentFailures: readArray(readAlias(record, 'recent_failures', 'recentFailures')).map(
      normalizeMonitoringEvent
    ),
  };
};

export const normalizeMonitoringAnalyticsResponse = (raw: unknown): MonitoringAnalyticsResponse => {
  const record = isRecord(raw) ? raw : {};
  return {
    generatedAtMs: readNumber(readAlias(record, 'generated_at_ms', 'generatedAtMs')),
    granularity: readString(record.granularity) ?? 'hour',
    summary: record.summary === undefined ? undefined : normalizeMetrics(record.summary),
    accountStats: readArray(readAlias(record, 'account_stats', 'accountStats')),
    apiKeyStats: readArray(readAlias(record, 'api_key_stats', 'apiKeyStats')),
    filterOptions: readAlias(record, 'filter_options', 'filterOptions'),
    events: record.events === undefined ? undefined : normalizeMonitoringEventsPage(record.events),
    recentFailures:
      record.recent_failures === undefined
        ? undefined
        : readArray(record.recent_failures).map(normalizeMonitoringEvent),
  };
};

export const normalizeUsageStatusResponse = (raw: unknown): UsageStatus => {
  const record = isRecord(raw) ? raw : {};
  const collector = isRecord(record.collector) ? record.collector : undefined;
  return {
    service: readString(record.service),
    source: readString(record.source),
    events: readNumber(record.events),
    deadLetters: readNumber(readAlias(record, 'deadLetters', 'dead_letters')),
    dbPath: readString(readAlias(record, 'dbPath', 'db_path')),
    dbSizeBytes: readNumber(readAlias(record, 'dbSizeBytes', 'db_size_bytes')),
    status: normalizeUsageStatus(record.status),
    collector: collector
      ? {
          collector: readString(collector.collector),
          mode: readString(collector.mode),
          queueSize: readNumber(readAlias(collector, 'queueSize', 'queue_size')),
          totalInserted: readNumber(readAlias(collector, 'totalInserted', 'total_inserted')),
          totalDropped: readNumber(readAlias(collector, 'totalDropped', 'total_dropped')),
          totalSkipped: readNumber(readAlias(collector, 'totalSkipped', 'total_skipped')),
          lastInsertedAt: readNumber(readAlias(collector, 'lastInsertedAt', 'last_inserted_at')),
          lastError: readString(readAlias(collector, 'lastError', 'last_error')),
        }
      : undefined,
  };
};

const normalizeModelPrice = (raw: unknown): ModelPrice => {
  if (!isRecord(raw)) return {};
  const price: ModelPrice = { ...raw };
  const cacheRead = readAlias(raw, 'cache_read', 'cacheRead');
  const cacheCreation = readAlias(raw, 'cache_creation', 'cacheCreation');
  if (cacheRead !== undefined) price.cacheRead = readNumber(cacheRead);
  if (cacheCreation !== undefined) price.cacheCreation = readNumber(cacheCreation);
  return price;
};

export const normalizeModelPricesResponse = (raw: unknown): ModelPricesResponse => {
  const record = isRecord(raw) ? raw : {};
  const pricesRecord = isRecord(record.prices) ? record.prices : {};
  return {
    prices: Object.fromEntries(
      Object.entries(pricesRecord).map(([model, price]) => [model, normalizeModelPrice(price)])
    ),
  };
};

export const normalizeModelPriceUsageSummary = (raw: unknown): ModelPriceUsageSummaryResponse => {
  const record = isRecord(raw) ? raw : {};
  return {
    sampledEvents: readNumber(readAlias(record, 'sampled_events', 'sampledEvents')),
    totalEvents: readNumber(readAlias(record, 'total_events', 'totalEvents')),
    truncated: readBoolean(record.truncated),
    models: readRecordArray(record.models).map((item) => ({
      model: readString(item.model) ?? '',
      calls: readNumber(item.calls),
      requestedCalls: readNumber(readAlias(item, 'requested_calls', 'requestedCalls')),
      resolvedCalls: readNumber(readAlias(item, 'resolved_calls', 'resolvedCalls')),
    })),
  };
};

export const normalizeModelPriceSyncResponse = (raw: unknown): ModelPriceSyncResponse => {
  const record = isRecord(raw) ? raw : {};
  return {
    ...normalizeModelPricesResponse(raw),
    source: readString(record.source),
    sources: readArray(record.sources).map((item) => String(item)),
    imported: readNumber(record.imported),
    skipped: readNumber(record.skipped),
    matched: isRecord(record.matched)
      ? Object.fromEntries(
          Object.entries(record.matched).map(([model, price]) => [
            model,
            normalizeModelPrice(price),
          ])
        )
      : undefined,
    candidates: readArray(record.candidates),
    unmatched: readArray(record.unmatched).map((item) => String(item)),
    proxyUsed: readBoolean(readAlias(record, 'proxyUsed', 'proxy_used')),
    sourceResults: readArray(readAlias(record, 'sourceResults', 'source_results')),
  };
};

const normalizeAccountActionCandidate = (raw: unknown): AccountActionCandidate => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record.id),
    actionType: readString(readAlias(record, 'action_type', 'actionType')) ?? 'review',
    status: readString(record.status) ?? 'pending',
    provider: readString(record.provider),
    authFileName: readString(readAlias(record, 'auth_file_name', 'authFileName')) ?? '',
    authIndex: readString(readAlias(record, 'auth_index', 'authIndex')),
    authLabel: readString(readAlias(record, 'auth_label', 'authLabel')),
    reason: readString(record.reason) ?? '',
    evidence: record.evidence,
    lastError: readString(readAlias(record, 'last_error', 'lastError')),
    firstSeenAtMs: readNumber(readAlias(record, 'first_seen_at_ms', 'firstSeenAtMs')),
    lastSeenAtMs: readNumber(readAlias(record, 'last_seen_at_ms', 'lastSeenAtMs')),
    hitCount: readNumber(readAlias(record, 'hit_count', 'hitCount')),
    createdAtMs: readNumber(readAlias(record, 'created_at_ms', 'createdAtMs')),
    updatedAtMs: readNumber(readAlias(record, 'updated_at_ms', 'updatedAtMs')),
  };
};

export const normalizeAccountActionCandidatesResponse = (
  raw: unknown
): AccountActionCandidatesResponse => {
  const record = isRecord(raw) ? raw : {};
  return {
    items: readArray(record.items).map(normalizeAccountActionCandidate),
    pendingCount: readNumber(readAlias(record, 'pending_count', 'pendingCount')),
  };
};

export const normalizeUsageImportResponse = (raw: unknown): UsageImportResponse => {
  const record = isRecord(raw) ? raw : {};
  return {
    format: readString(record.format),
    added: readNumber(record.added),
    skipped: readNumber(record.skipped),
    total: readNumber(record.total),
    failed: readNumber(record.failed),
    unsupported: record.unsupported === undefined ? undefined : readNumber(record.unsupported),
    warnings: readArray(record.warnings).map((item) => String(item)),
  };
};

export const normalizeUsageImportSession = (raw: unknown): UsageImportSession => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readString(record.id) ?? '',
    filename: readString(record.filename) ?? '',
    status: readString(record.status) ?? 'uploading',
    sizeBytes: readNumber(readAlias(record, 'size_bytes', 'sizeBytes')),
    receivedBytes: readNumber(readAlias(record, 'received_bytes', 'receivedBytes')),
    chunkSizeBytes: readNumber(readAlias(record, 'chunk_size_bytes', 'chunkSizeBytes')),
    createdAtMs: readNumber(readAlias(record, 'created_at_ms', 'createdAtMs')),
    updatedAtMs: readNumber(readAlias(record, 'updated_at_ms', 'updatedAtMs')),
    expiresAtMs: readNumber(readAlias(record, 'expires_at_ms', 'expiresAtMs')),
    retryable: readBoolean(record.retryable),
    error: readString(record.error),
    result: isRecord(record.result) ? normalizeUsageImportResponse(record.result) : undefined,
  };
};

export const assertUsageImportSessionRedacted = (raw: WireUsageImportSession): void => {
  if (raw.resume_key !== undefined || raw.resumeKey !== undefined) {
    throw new Error('Usage import session response must not expose resume keys.');
  }
};

export const usageServiceApi = {
  getCapabilities: (): Promise<UsageApiResult<UsageCapabilities>> =>
    requestUsageApiResult(
      () => apiClient.get('/usage/capabilities', { timeout: USAGE_API_TIMEOUT_MS }),
      normalizeUsageCapabilities
    ),
  getStatus: (): Promise<UsageApiResult<UsageStatus>> =>
    requestUsageApiResult(
      () => apiClient.get('/usage/status', { timeout: USAGE_API_TIMEOUT_MS }),
      normalizeUsageStatusResponse
    ),
  importUsage: (payload: Blob | string): Promise<UsageApiResult<UsageImportResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.post('/usage/import', payload, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
        }),
      normalizeUsageImportResponse
    ),
};

export const dashboardApi = {
  getSummary: (params: DashboardSummaryParams): Promise<UsageApiResult<DashboardSummary>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/usage/dashboard/summary', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: serializeDashboardSummaryParams(params),
        }),
      normalizeDashboardSummary
    ),
};

export const monitoringApi = {
  getAccounts: (params?: MonitoringListParams): Promise<UsageApiResult<unknown>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/usage/monitoring/accounts', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: serializeMonitoringListParams(params),
        }),
      (payload) => payload
    ),
  getKeys: (params?: MonitoringListParams): Promise<UsageApiResult<unknown>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/usage/monitoring/keys', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: serializeMonitoringListParams(params),
        }),
      (payload) => payload
    ),
  getRealtime: (params?: MonitoringListParams): Promise<UsageApiResult<unknown>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/usage/monitoring/realtime', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: serializeMonitoringListParams(params),
        }),
      (payload) => payload
    ),
  getSelectors: (params?: MonitoringListParams): Promise<UsageApiResult<unknown>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/usage/monitoring/selectors', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: serializeMonitoringListParams(params),
        }),
      (payload) => payload
    ),
  getAnalytics: (
    request: MonitoringAnalyticsRequest,
    signal?: AbortSignal
  ): Promise<UsageApiResult<MonitoringAnalyticsResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(
          '/usage/monitoring/analytics',
          serializeMonitoringAnalyticsRequest(request),
          {
            timeout: USAGE_API_TIMEOUT_MS,
            signal,
          }
        ),
      normalizeMonitoringAnalyticsResponse
    ),
};

export const modelPricesApi = {
  getPrices: (): Promise<UsageApiResult<ModelPricesResponse>> =>
    requestUsageApiResult(
      () => apiClient.get('/model-prices', { timeout: USAGE_API_TIMEOUT_MS }),
      normalizeModelPricesResponse
    ),
  savePrices: (prices: Record<string, ModelPrice>): Promise<UsageApiResult<ModelPricesResponse>> =>
    requestUsageApiResult(
      () => apiClient.put('/model-prices', { prices }, { timeout: USAGE_API_TIMEOUT_MS }),
      normalizeModelPricesResponse
    ),
  deletePrice: (model: string): Promise<UsageApiResult<ModelPricesResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.delete(`/model-prices/${encodeURIComponent(model)}`, {
          timeout: USAGE_API_TIMEOUT_MS,
        }),
      normalizeModelPricesResponse
    ),
  getUsageSummary: (limit?: number): Promise<UsageApiResult<ModelPriceUsageSummaryResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/model-prices/usage-summary', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: limit === undefined ? undefined : { limit },
        }),
      normalizeModelPriceUsageSummary
    ),
  sync: (models?: string[]): Promise<UsageApiResult<ModelPriceSyncResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.post('/model-prices/sync', models ? { models } : {}, {
          timeout: USAGE_API_TIMEOUT_MS,
        }),
      normalizeModelPriceSyncResponse
    ),
};

export const accountActionsApi = {
  list: (
    status = 'pending',
    limit = 100
  ): Promise<UsageApiResult<AccountActionCandidatesResponse>> =>
    requestUsageApiResult(
      () =>
        apiClient.get('/account-action-candidates', {
          timeout: USAGE_API_TIMEOUT_MS,
          params: { status, limit },
        }),
      normalizeAccountActionCandidatesResponse
    ),
  ignore: (id: number): Promise<UsageApiResult<{ item?: AccountActionCandidate }>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(
          `/account-action-candidates/${encodeURIComponent(String(id))}/ignore`,
          undefined,
          { timeout: USAGE_API_TIMEOUT_MS }
        ),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          item:
            record.item === undefined ? undefined : normalizeAccountActionCandidate(record.item),
        };
      }
    ),
  resolve: (id: number): Promise<UsageApiResult<{ item?: AccountActionCandidate }>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(
          `/account-action-candidates/${encodeURIComponent(String(id))}/resolve`,
          undefined,
          { timeout: USAGE_API_TIMEOUT_MS }
        ),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          item:
            record.item === undefined ? undefined : normalizeAccountActionCandidate(record.item),
        };
      }
    ),
  enable: (id: number): Promise<UsageApiResult<{ item?: AccountActionCandidate }>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(
          `/account-action-candidates/${encodeURIComponent(String(id))}/enable`,
          undefined,
          { timeout: USAGE_API_TIMEOUT_MS }
        ),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          item:
            record.item === undefined ? undefined : normalizeAccountActionCandidate(record.item),
        };
      }
    ),
  deleteAuthFile: (id: number): Promise<UsageApiResult<{ item?: AccountActionCandidate }>> =>
    requestUsageApiResult(
      () =>
        apiClient.delete(`/account-action-candidates/${encodeURIComponent(String(id))}/auth-file`, {
          timeout: USAGE_API_TIMEOUT_MS,
        }),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          item:
            record.item === undefined ? undefined : normalizeAccountActionCandidate(record.item),
        };
      }
    ),
};

export const usageImportSessionApi = {
  create: (
    request: UsageImportSessionCreateRequest,
    signal?: AbortSignal
  ): Promise<UsageApiResult<UsageImportSession>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(
          '/usage/import-sessions',
          serializeUsageImportSessionCreateRequest(request),
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            signal,
          }
        ),
      (payload) => {
        if (isRecord(payload)) assertUsageImportSessionRedacted(payload);
        return normalizeUsageImportSession(payload);
      }
    ),
  get: (id: string, signal?: AbortSignal): Promise<UsageApiResult<UsageImportSession>> =>
    requestUsageApiResult(
      () =>
        apiClient.get(`/usage/import-sessions/${encodeURIComponent(id)}`, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          signal,
        }),
      normalizeUsageImportSession
    ),
  uploadChunk: (
    id: string,
    offset: number,
    payload: Blob,
    signal?: AbortSignal
  ): Promise<UsageApiResult<UsageImportSession>> =>
    requestUsageApiResult(
      () =>
        apiClient.put(`/usage/import-sessions/${encodeURIComponent(id)}/chunk`, payload, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          params: { offset },
          signal,
        }),
      normalizeUsageImportSession
    ),
  complete: (id: string, signal?: AbortSignal): Promise<UsageApiResult<UsageImportSession>> =>
    requestUsageApiResult(
      () =>
        apiClient.post(`/usage/import-sessions/${encodeURIComponent(id)}/complete`, undefined, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          signal,
        }),
      normalizeUsageImportSession
    ),
  cancel: (id: string, signal?: AbortSignal): Promise<UsageApiResult<UsageImportSession>> =>
    requestUsageApiResult(
      () =>
        apiClient.delete(`/usage/import-sessions/${encodeURIComponent(id)}`, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          signal,
        }),
      normalizeUsageImportSession
    ),
};
