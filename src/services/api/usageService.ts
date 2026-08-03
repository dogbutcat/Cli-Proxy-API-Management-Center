import { apiClient } from './client';
import { normalizeApiBase } from '@/utils/connection';
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

export interface UsageServiceInfo {
  service?: string;
  mode?: string;
  startedAt?: number;
  configured?: boolean;
  adminReady?: boolean;
  projectInitialized?: boolean;
  setupRequired?: boolean;
  migrationStatus?: string;
  dataKeyReady?: boolean;
  hasHistoricalData?: boolean;
}

export interface ManagerCPAConnectionConfig {
  cpaBaseUrl: string;
  managementKey?: string;
}

export interface ManagerCollectorConfig {
  enabled?: boolean;
  collectorMode: string;
  queue: string;
  popSide: string;
  batchSize: number;
  pollIntervalMs: number;
  queryLimit: number;
  tlsSkipVerify?: boolean;
}

export interface ManagerExternalUsageServiceConfig {
  enabled: boolean;
  serviceBase: string;
}

export interface ManagerConfig {
  cpaConnection: ManagerCPAConnectionConfig;
  collector: ManagerCollectorConfig;
  externalUsageService: ManagerExternalUsageServiceConfig;
  updatedAtMs?: number;
}

export interface ManagerConfigResponse {
  config: ManagerConfig;
  source?: 'env' | 'db' | 'integrated' | '';
}

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
  trafficTimeline: DashboardTrafficPoint[];
  todayRequestHealthTimeline: DashboardRequestHealthTimeline;
  providerActivity: DashboardProviderActivity[];
  channelHealth: DashboardChannelHealth[];
  recentFailures: MonitoringEvent[];
};

export type DashboardTrafficPoint = {
  bucketMs: number;
  calls: number;
  tokens: number;
  success: number;
  failure: number;
  failureRate: number;
};

export type DashboardHealthPoint = {
  bucketMs: number;
  calls: number;
  tokens: number;
  success: number;
  failure: number;
  successRate: number;
  failureRate: number;
  tone: string;
  intensity: number;
  future: boolean;
};

export type DashboardRequestHealthTimeline = {
  fromMs: number;
  toMs: number;
  bucketMs: number;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  points: DashboardHealthPoint[];
};

export type DashboardChannelHealth = {
  source: string;
  sourceHash: string;
  authIndex: string;
  authProviderSnapshot: string;
  authLabelSnapshot: string;
  accountSnapshot: string;
  apiKeyHash: string;
  calls: number;
  failures: number;
  tokens: number;
  cost: number;
  averageLatencyMs: number | null;
  successRate: number;
  failureRate: number;
  tone: string;
};

export type DashboardProviderActivity = {
  provider: string;
  calls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  tokens: number;
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
  credential_ids?: string[];
  authFiles?: string[];
  auth_files?: string[];
  authIndices?: string[];
  auth_indices?: string[];
  apiKeyHashes?: string[];
  api_key_hashes?: string[];
  sourceHashes?: string[];
  source_hashes?: string[];
  projectIds?: string[];
  project_ids?: string[];
  requestTypes?: string[];
  request_types?: string[];
  headerErrorKinds?: string[];
  header_error_kinds?: string[];
  headerErrorCodes?: string[];
  header_error_codes?: string[];
  headerQuotaPlans?: string[];
  header_quota_plans?: string[];
  headerTraceIds?: string[];
  header_trace_ids?: string[];
  includeFailed?: boolean;
  include_failed?: boolean;
  failedOnly?: boolean;
  failed_only?: boolean;
  minLatencyMs?: number;
  min_latency_ms?: number;
  cacheStatus?: string;
  cache_status?: string;
};

export type MonitoringAnalyticsInclude = {
  summary?: boolean;
  summaryProfile?: 'compact' | 'full' | string;
  summary_profile?: 'compact' | 'full' | string;
  summaryComparison?: boolean;
  summary_comparison?: boolean;
  timeline?: boolean;
  hourlyDistribution?: boolean;
  hourly_distribution?: boolean;
  modelShare?: boolean;
  model_share?: boolean;
  channelShare?: boolean;
  channel_share?: boolean;
  modelStats?: boolean;
  model_stats?: boolean;
  failureSources?: boolean;
  failure_sources?: boolean;
  accountStats?: boolean;
  account_stats?: boolean;
  credentialStats?: boolean;
  credential_stats?: boolean;
  credentialTimeline?: boolean;
  credential_timeline?: boolean;
  apiKeyStats?: boolean;
  api_key_stats?: boolean;
  filterOptions?: boolean;
  filter_options?: boolean;
  filterSelectors?: boolean;
  filter_selectors?: boolean;
  heatmap?: boolean;
  anomalyPoints?: boolean;
  anomaly_points?: boolean;
  taskBuckets?: boolean;
  task_buckets?: boolean;
  recentFailures?: number;
  recent_failures?: number;
  eventsPage?: {
    limit?: number;
    beforeMs?: number | null;
    beforeId?: number | null;
  };
  events_page?: {
    limit?: number;
    before_ms?: number | null;
    before_id?: number | null;
  };
  drilldownPreview?: {
    fromMs: number;
    toMs: number;
    limit?: number;
  };
  drilldown_preview?: {
    from_ms: number;
    to_ms: number;
    limit?: number;
  };
  granularity?: 'hour' | 'day' | string;
};

export type MonitoringAnalyticsEventsPageRequest = {
  limit?: number;
  before_ms?: number | null;
  before_id?: number | null;
};

export type MonitoringAnalyticsRequest = {
  fromMs?: number;
  from_ms?: number;
  toMs?: number;
  to_ms?: number;
  nowMs?: number;
  now_ms?: number;
  timeZone?: string;
  time_zone?: string;
  searchQuery?: string;
  search_query?: string;
  searchApiKeyHash?: string;
  search_api_key_hash?: string;
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
  request_id?: string;
  requestId?: string;
  event_hash?: string;
  eventHash: string;
  timestamp_ms?: number;
  timestampMs: number;
  provider?: string;
  model: string;
  resolved_model?: string;
  resolvedModel?: string;
  endpoint: string;
  method?: string;
  path?: string;
  auth_index?: string;
  authIndex: string;
  source?: string;
  source_hash?: string;
  sourceHash: string;
  api_key_hash?: string;
  apiKeyHash?: string;
  account_snapshot?: string;
  accountSnapshot?: string;
  auth_label_snapshot?: string;
  authLabelSnapshot?: string;
  auth_file_snapshot?: string;
  authFileSnapshot?: string;
  auth_provider_snapshot?: string;
  authProviderSnapshot?: string;
  auth_project_id_snapshot?: string;
  authProjectIdSnapshot?: string;
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  totalTokens: number;
  failed: boolean;
  fail_status_code?: number | null;
  failStatusCode?: number | null;
  fail_summary?: string;
  failSummary?: string;
  latency_ms?: number | null;
  latencyMs?: number | null;
  response_metadata?: ResponseHeaderMetadata;
  header_quota_recover_at_ms?: number | null;
  header_quota_used_percent?: number | null;
  header_quota_plan_type?: string;
  header_error_kind?: string;
  header_error_code?: string;
  header_trace_id?: string;
  headerTraceId?: string;
};

export type MonitoringAnalyticsEventRow = MonitoringEvent & {
  event_hash: string;
  timestamp_ms: number;
  auth_index: string;
  source_hash: string;
  api_key_hash: string;
  account_snapshot: string;
  auth_label_snapshot: string;
  auth_provider_snapshot: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  reasoning_effort?: string;
  service_tier?: string;
  executor_type?: string;
  ttft_ms?: number | null;
};

export type MonitoringEventsPage = {
  items: MonitoringAnalyticsEventRow[];
  nextCursor: string | null;
  next_cursor?: string | null;
  nextBeforeMs: number | null;
  next_before_ms: number | null;
  nextBeforeId: number | null;
  next_before_id?: number | null;
  hasMore: boolean;
  has_more: boolean;
  totalCount?: number | null;
  total_count?: number | null;
};

export type MonitoringAnalyticsEventsResponse = MonitoringEventsPage;

export type MonitoringAnalyticsSummary = UsageSummaryMetrics & {
  total_calls: number;
  success_calls: number;
  failure_calls: number;
  success_rate: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  total_cost: number;
  average_cost_per_call?: number;
  average_latency_ms: number | null;
  p95_latency_ms?: number | null;
  p95_ttft_ms?: number | null;
  zero_token_calls: number;
  rpm_30m: number;
  tpm_30m: number;
  avg_daily_requests: number;
  avg_daily_tokens: number;
  approx_tasks: number;
  approx_task_failures: number;
  approx_task_success_rate: number;
  zero_token_models: string[];
};

export interface MonitoringAnalyticsTimelinePoint {
  bucket_ms: number;
  bucket_end_ms?: number;
  label: string;
  calls: number;
  tokens: number;
  success: number;
  failure: number;
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  cost?: number;
  average_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  p95_ttft_ms?: number | null;
  success_rate?: number;
  failure_rate?: number;
}

export interface MonitoringAnalyticsHourlyPoint {
  hour: number;
  calls: number;
  tokens: number;
}

export interface MonitoringAnalyticsSummaryComparison {
  from_ms: number;
  to_ms: number;
  total_calls: number;
  success_calls: number;
  failure_calls: number;
  success_rate: number;
  total_tokens: number;
  total_cost: number;
}

export interface MonitoringAnalyticsHeatmapContributor {
  key: string;
  label?: string;
  calls: number;
  success: number;
  failure: number;
  tokens: number;
  cost: number;
  failure_rate: number;
  share: number;
}

export interface MonitoringAnalyticsHeatmapPoint {
  weekday: number;
  hour: number;
  calls: number;
  success: number;
  failure: number;
  tokens: number;
  cost: number;
  failure_rate: number;
  model_contributors?: MonitoringAnalyticsHeatmapContributor[];
  api_key_contributors?: MonitoringAnalyticsHeatmapContributor[];
  provider_contributors?: MonitoringAnalyticsHeatmapContributor[];
}

export type MonitoringAnalyticsAnomalySeverity = 'low' | 'medium' | 'high' | string;

export interface MonitoringAnalyticsAnomalyPoint {
  bucket_ms: number;
  bucket_end_ms: number;
  label: string;
  severity: MonitoringAnalyticsAnomalySeverity;
  metric_keys: string[];
  calls: number;
  total_tokens: number;
  cost: number;
  failure_rate: number;
  request_change: number;
  cost_change: number;
  tokens_per_request_change: number;
  cache_hit_rate_change: number;
  failure_rate_change: number;
  latency_p95_change: number;
}

export interface MonitoringAnalyticsModelShareRow {
  model: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface MonitoringAnalyticsModelStat extends MonitoringAnalyticsModelShareRow {
  success_calls: number;
  failure_calls: number;
  success_rate: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
}

export interface MonitoringAnalyticsChannelShareRow {
  auth_index: string;
  source?: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  calls: number;
  success: number;
  failure: number;
  tokens: number;
  cost: number;
  average_latency_ms: number | null;
}

export interface MonitoringAnalyticsFailureSourceRow {
  source?: string;
  source_hash: string;
  auth_index: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  calls: number;
  failure: number;
  last_seen_ms: number;
  average_latency_ms: number | null;
}

export interface MonitoringAnalyticsAccountModelStatRow extends MonitoringAnalyticsModelStat {
  last_seen_ms: number;
}

export interface MonitoringAnalyticsAccountStatRow {
  id: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  auth_indices?: string[];
  sources?: string[];
  source_hashes?: string[];
  calls: number;
  success_calls: number;
  failure_calls: number;
  success_rate: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
  cost: number;
  average_latency_ms: number | null;
  last_seen_ms: number;
  models?: MonitoringAnalyticsAccountModelStatRow[];
}

export interface MonitoringAnalyticsCredentialStatRow extends MonitoringAnalyticsAccountStatRow {
  auth_file_snapshot?: string;
  auth_index?: string;
  source?: string;
  source_hash?: string;
  auth_project_id_snapshot?: string;
}

export interface MonitoringAnalyticsCredentialTimelinePoint extends MonitoringAnalyticsTimelinePoint {
  id: string;
  bucket_label?: string;
  auth_file_snapshot?: string;
  auth_index?: string;
  source?: string;
  source_hash?: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  auth_project_id_snapshot?: string;
}

export interface MonitoringAnalyticsApiKeyContextRow {
  id: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  auth_index?: string;
  source?: string;
  source_hash?: string;
  calls: number;
  success_calls: number;
  failure_calls: number;
  success_rate: number;
  failure_rate: number;
  total_tokens: number;
  cost: number;
  average_latency_ms?: number | null;
  last_seen_ms: number;
}

export interface MonitoringAnalyticsApiKeyStatRow extends MonitoringAnalyticsAccountStatRow {
  api_key_hash: string;
  contexts?: MonitoringAnalyticsApiKeyContextRow[];
}

export interface MonitoringAnalyticsFilterOptions {
  account_stats?: MonitoringAnalyticsAccountStatRow[];
  api_key_stats?: MonitoringAnalyticsApiKeyStatRow[];
  channel_share?: MonitoringAnalyticsChannelShareRow[];
  model_stats?: MonitoringAnalyticsModelStat[];
  providers?: string[];
  models?: string[];
  accounts?: string[];
  api_key_hashes?: string[];
  auth_files?: string[];
  project_ids?: string[];
  request_types?: string[];
  header_error_kinds?: string[];
  header_error_codes?: string[];
  header_quota_plans?: string[];
  header_trace_ids?: string[];
  account_count?: number;
  api_key_count?: number;
}

export interface MonitoringAnalyticsTaskBucketRow {
  bucket_key: string;
  total: number;
  success: number;
  failure: number;
  first_ms: number;
  last_ms: number;
  source: string;
  source_hash: string;
  auth_index: string;
  models: string[];
  endpoints: string[];
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
  average_latency_ms: number | null;
  max_latency_ms: number | null;
}

export interface ResponseHeaderQuotaWindow {
  used_percent?: number;
  reset_at_ms?: number;
  reset_after_seconds?: number;
  window_minutes?: number;
}

export interface ResponseHeaderQuotaMetadata {
  plan_type?: string;
  active_limit?: string;
  rate_limit_reached_type?: string;
  summary_window_kind?: string;
  summary_window_source?: string;
  reached_window_kind?: string;
  reached_window_source?: string;
  credits_balance?: string;
  credits_has_credits?: boolean;
  credits_unlimited?: boolean;
  primary_over_secondary_limit_percent?: number;
  primary?: ResponseHeaderQuotaWindow;
  secondary?: ResponseHeaderQuotaWindow;
  recover_at_ms?: number;
  used_percent?: number;
}

export interface ResponseHeaderErrorMetadata {
  kind?: string;
  code?: string;
  authorization_error?: string;
  ide_error_code?: string;
  ide_root_error_code?: string;
  retry_after_seconds?: number;
  retry_after_recover_at_ms?: number;
  rate_limit_bypass?: string;
}

export interface ResponseHeaderTraceMetadata {
  primary_trace_id?: string;
  openai_request_id?: string;
  request_id?: string;
  oneapi_request_id?: string;
  cf_ray?: string;
  eagle_id?: string;
  cloud_ai_companion_trace_id?: string;
  client_request_id?: string;
  zeabur_request_id?: string;
}

export interface ResponseHeaderRoutingMetadata {
  openai_proxy_wasm?: string;
  models_etag?: string;
  new_api_version?: string;
  server?: string;
  via?: string;
  cf_cache_status?: string;
  site_cache_status?: string;
  served_by?: string;
  mife_upstream_status?: string;
}

export interface ResponseHeaderResponseMetadata {
  content_type?: string;
  content_length?: number;
  content_disposition?: string;
  server_timing?: string;
}

export interface ResponseHeaderProviderMetadata {
  antigravity_trace_id?: string;
  antigravity_server_timing?: string;
  mife_upstream_status?: string;
  oneapi_request_id?: string;
  cloudflare_ray?: string;
  cloudflare_cache_status?: string;
}

export interface ResponseHeaderMetadata {
  quota?: ResponseHeaderQuotaMetadata;
  errors?: ResponseHeaderErrorMetadata;
  trace?: ResponseHeaderTraceMetadata;
  routing?: ResponseHeaderRoutingMetadata;
  response?: ResponseHeaderResponseMetadata;
  providers?: ResponseHeaderProviderMetadata;
}

export interface UsageHeaderSnapshot {
  event_hash: string;
  timestamp_ms: number;
  auth_file_snapshot?: string;
  auth_index?: string;
  account_snapshot?: string;
  auth_label_snapshot?: string;
  auth_provider_snapshot?: string;
  auth_project_id_snapshot?: string;
  source?: string;
  source_hash?: string;
  response_metadata?: ResponseHeaderMetadata;
  header_quota_recover_at_ms?: number | null;
  header_quota_used_percent?: number | null;
  header_quota_plan_type?: string;
  header_error_kind?: string;
  header_error_code?: string;
  header_trace_id?: string;
}

export interface UsageHeaderSnapshotsResponse {
  generated_at_ms: number;
  from_ms: number;
  to_ms: number;
  items: UsageHeaderSnapshot[];
}

export type MonitoringAnalyticsRecentFailure = MonitoringAnalyticsEventRow & {
  duration_ms?: number | null;
};

export type MonitoringAnalyticsResponse = {
  generatedAtMs: number;
  generated_at_ms?: number;
  granularity: string;
  summary?: MonitoringAnalyticsSummary;
  summary_comparison?: MonitoringAnalyticsSummaryComparison;
  timeline?: MonitoringAnalyticsTimelinePoint[];
  hourly_distribution?: MonitoringAnalyticsHourlyPoint[];
  heatmap?: MonitoringAnalyticsHeatmapPoint[];
  anomaly_points?: MonitoringAnalyticsAnomalyPoint[];
  model_share?: MonitoringAnalyticsModelShareRow[];
  model_stats?: MonitoringAnalyticsModelStat[];
  channel_share?: MonitoringAnalyticsChannelShareRow[];
  failure_sources?: MonitoringAnalyticsFailureSourceRow[];
  accountStats?: MonitoringAnalyticsAccountStatRow[];
  account_stats?: MonitoringAnalyticsAccountStatRow[];
  credential_stats?: MonitoringAnalyticsCredentialStatRow[];
  credential_timeline?: MonitoringAnalyticsCredentialTimelinePoint[];
  apiKeyStats?: MonitoringAnalyticsApiKeyStatRow[];
  api_key_stats?: MonitoringAnalyticsApiKeyStatRow[];
  filterOptions?: MonitoringAnalyticsFilterOptions;
  filter_options?: MonitoringAnalyticsFilterOptions;
  task_buckets?: MonitoringAnalyticsTaskBucketRow[];
  events?: MonitoringAnalyticsEventsResponse;
  drilldown_preview?: MonitoringAnalyticsEventsResponse;
  recentFailures?: MonitoringAnalyticsRecentFailure[];
  recent_failures?: MonitoringAnalyticsRecentFailure[];
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
  prompt: number;
  completion: number;
  cache: number;
  input?: number;
  output?: number;
  cached?: number;
  cacheRead?: number;
  cache_read?: number;
  cacheCreation?: number;
  cache_creation?: number;
  currency?: string;
  unit?: number;
  [key: string]: unknown;
};

export type ModelPricesResponse = {
  prices: Record<string, ModelPrice>;
};

export type ModelPriceUsageSummaryResponse = {
  sampledEvents: number;
  sampled_events?: number;
  totalEvents: number;
  total_events?: number;
  truncated: boolean;
  models: Array<{
    model: string;
    calls: number;
    requested_calls?: number;
    requestedCalls: number;
    resolved_calls?: number;
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

export type ApiKeyAlias = {
  apiKeyHash: string;
  api_key_hash?: string;
  alias: string;
  updatedAtMs?: number;
  updated_at_ms?: number;
};

export type ApiKeyAliasesResponse = {
  items: ApiKeyAlias[];
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

export type UsageExportResponse = {
  blob: Blob;
  filename: string;
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
  sizeBytes?: number;
  size_bytes?: number;
  resumeKey?: string;
  resume_key?: string;
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

export const normalizeUsageServiceBase = (value: string): string => normalizeApiBase(value);

export const isUsageServiceId = (value: unknown): boolean => {
  const service = readString(value)?.toLowerCase();
  return (
    service === 'cli-proxy-api-management' ||
    service === 'cli-proxy-api-usage' ||
    service === 'cpa-manager-plus' ||
    service === 'cpa-manager' ||
    service === 'cpa-usage-service'
  );
};

const buildUsageServiceUrl = (base: string, path: string): string =>
  `${normalizeUsageServiceBase(base).replace(/\/+$/, '')}${path}`;

const authHeaders = (managementKey?: string) =>
  managementKey ? { Authorization: `Bearer ${managementKey}` } : undefined;

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
  const fromMs = request.fromMs ?? request.from_ms ?? 0;
  const toMs = request.toMs ?? request.to_ms ?? Date.now();
  const wire: WireMonitoringAnalyticsRequest = {
    from_ms: fromMs,
    to_ms: toMs,
  };
  maybeSet(wire, 'now_ms', request.nowMs ?? request.now_ms);
  maybeSet(wire, 'time_zone', request.timeZone ?? request.time_zone);
  maybeSet(wire, 'search_query', request.searchQuery ?? request.search_query);
  maybeSet(wire, 'search_api_key_hash', request.searchApiKeyHash ?? request.search_api_key_hash);
  if (filters) {
    wire.filters = {};
    maybeSet(wire.filters, 'models', filters.models);
    maybeSet(wire.filters, 'providers', filters.providers);
    maybeSet(wire.filters, 'accounts', filters.accounts);
    maybeSet(wire.filters, 'credential_ids', filters.credentialIds ?? filters.credential_ids);
    maybeSet(wire.filters, 'auth_files', filters.authFiles ?? filters.auth_files);
    maybeSet(wire.filters, 'auth_indices', filters.authIndices ?? filters.auth_indices);
    maybeSet(wire.filters, 'api_key_hashes', filters.apiKeyHashes ?? filters.api_key_hashes);
    maybeSet(wire.filters, 'source_hashes', filters.sourceHashes ?? filters.source_hashes);
    maybeSet(wire.filters, 'project_ids', filters.projectIds ?? filters.project_ids);
    maybeSet(wire.filters, 'request_types', filters.requestTypes ?? filters.request_types);
    maybeSet(wire.filters, 'header_error_kinds', filters.headerErrorKinds ?? filters.header_error_kinds);
    maybeSet(wire.filters, 'header_error_codes', filters.headerErrorCodes ?? filters.header_error_codes);
    maybeSet(wire.filters, 'header_quota_plans', filters.headerQuotaPlans ?? filters.header_quota_plans);
    maybeSet(wire.filters, 'header_trace_ids', filters.headerTraceIds ?? filters.header_trace_ids);
    maybeSet(wire.filters, 'include_failed', filters.includeFailed ?? filters.include_failed);
    maybeSet(wire.filters, 'failed_only', filters.failedOnly ?? filters.failed_only);
    maybeSet(wire.filters, 'min_latency_ms', filters.minLatencyMs ?? filters.min_latency_ms);
    maybeSet(wire.filters, 'cache_status', filters.cacheStatus ?? filters.cache_status);
  }
  if (include) {
    wire.include = {};
    maybeSet(wire.include, 'summary', include.summary);
    maybeSet(wire.include, 'summary_profile', include.summaryProfile ?? include.summary_profile);
    maybeSet(wire.include, 'summary_comparison', include.summaryComparison ?? include.summary_comparison);
    maybeSet(wire.include, 'timeline', include.timeline);
    maybeSet(wire.include, 'hourly_distribution', include.hourlyDistribution ?? include.hourly_distribution);
    maybeSet(wire.include, 'model_share', include.modelShare ?? include.model_share);
    maybeSet(wire.include, 'channel_share', include.channelShare ?? include.channel_share);
    maybeSet(wire.include, 'model_stats', include.modelStats ?? include.model_stats);
    maybeSet(wire.include, 'failure_sources', include.failureSources ?? include.failure_sources);
    maybeSet(wire.include, 'account_stats', include.accountStats ?? include.account_stats);
    maybeSet(wire.include, 'credential_stats', include.credentialStats ?? include.credential_stats);
    maybeSet(wire.include, 'credential_timeline', include.credentialTimeline ?? include.credential_timeline);
    maybeSet(wire.include, 'api_key_stats', include.apiKeyStats ?? include.api_key_stats);
    maybeSet(wire.include, 'filter_options', include.filterOptions ?? include.filter_options);
    maybeSet(wire.include, 'filter_selectors', include.filterSelectors ?? include.filter_selectors);
    maybeSet(wire.include, 'heatmap', include.heatmap);
    maybeSet(wire.include, 'anomaly_points', include.anomalyPoints ?? include.anomaly_points);
    maybeSet(wire.include, 'task_buckets', include.taskBuckets ?? include.task_buckets);
    maybeSet(wire.include, 'recent_failures', include.recentFailures ?? include.recent_failures);
    maybeSet(wire.include, 'granularity', include.granularity);
    const eventsPage = include.eventsPage ?? include.events_page;
    if (eventsPage) {
      const page = eventsPage as {
        limit?: number;
        beforeMs?: number | null;
        beforeId?: number | null;
        before_ms?: number | null;
        before_id?: number | null;
      };
      wire.include.events_page = {
        limit: page.limit,
        before_ms: page.beforeMs ?? page.before_ms ?? null,
        before_id: page.beforeId ?? page.before_id ?? null,
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
    size_bytes: request.sizeBytes ?? request.size_bytes ?? 0,
  };
  maybeSet(wire, 'resume_key', request.resumeKey ?? request.resume_key);
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

const requestUsageApiData = async <T>(
  operation: () => Promise<unknown>,
  normalizeData: (payload: unknown) => T
): Promise<T> => {
  const result = await requestUsageApiResult(operation, normalizeData);
  if (result.kind === 'success' || result.kind === 'empty') return result.data;
  const error = new Error(result.message);
  error.name = result.kind === 'unsupported' ? 'UsageApiUnsupportedError' : 'UsageApiError';
  throw error;
};

const normalizeMonitoringSummary = (raw: unknown): MonitoringAnalyticsSummary => {
  const metrics = normalizeMetrics(raw);
  const record = isRecord(raw) ? raw : {};
  return {
    ...metrics,
    total_calls: metrics.totalCalls,
    success_calls: metrics.successCalls,
    failure_calls: metrics.failureCalls,
    success_rate: metrics.successRate,
    input_tokens: metrics.inputTokens,
    output_tokens: metrics.outputTokens,
    cached_tokens: metrics.cachedTokens,
    cache_read_tokens: metrics.cacheReadTokens,
    cache_creation_tokens: metrics.cacheCreationTokens,
    reasoning_tokens: metrics.reasoningTokens,
    total_tokens: metrics.totalTokens,
    total_cost: metrics.totalCost,
    average_cost_per_call: readNumber(
      readAlias(record, 'average_cost_per_call', 'averageCostPerCall')
    ),
    average_latency_ms: metrics.averageLatencyMs,
    p95_latency_ms: readNullableNumber(readAlias(record, 'p95_latency_ms', 'p95LatencyMs')),
    p95_ttft_ms: readNullableNumber(readAlias(record, 'p95_ttft_ms', 'p95TtftMs')),
    zero_token_calls: metrics.zeroTokenCalls,
    rpm_30m: readNumber(readAlias(record, 'rpm_30m', 'rpm30m')),
    tpm_30m: readNumber(readAlias(record, 'tpm_30m', 'tpm30m')),
    avg_daily_requests: readNumber(readAlias(record, 'avg_daily_requests', 'avgDailyRequests')),
    avg_daily_tokens: readNumber(readAlias(record, 'avg_daily_tokens', 'avgDailyTokens')),
    approx_tasks: readNumber(readAlias(record, 'approx_tasks', 'approxTasks')),
    approx_task_failures: readNumber(
      readAlias(record, 'approx_task_failures', 'approxTaskFailures')
    ),
    approx_task_success_rate: readNumber(
      readAlias(record, 'approx_task_success_rate', 'approxTaskSuccessRate')
    ),
    zero_token_models: readArray(readAlias(record, 'zero_token_models', 'zeroTokenModels')).map(
      (value) => String(value)
    ),
  };
};

const normalizeMetrics = (raw: unknown): UsageSummaryMetrics => {
  const record = isRecord(raw) ? raw : {};
  const totalCalls = readNumber(readAlias(record, 'total_calls', 'totalCalls'));
  const successCalls = readNumber(readAlias(record, 'success_calls', 'successCalls'));
  const failureCalls = readNumber(readAlias(record, 'failure_calls', 'failureCalls'));
  const successRate = readNumber(readAlias(record, 'success_rate', 'successRate'));
  const inputTokens = readNumber(readAlias(record, 'input_tokens', 'inputTokens'));
  const outputTokens = readNumber(readAlias(record, 'output_tokens', 'outputTokens'));
  const reasoningTokens = readNumber(readAlias(record, 'reasoning_tokens', 'reasoningTokens'));
  const cachedTokens = readNumber(readAlias(record, 'cached_tokens', 'cachedTokens'));
  const cacheReadTokens = readNumber(readAlias(record, 'cache_read_tokens', 'cacheReadTokens'));
  const cacheCreationTokens = readNumber(
    readAlias(record, 'cache_creation_tokens', 'cacheCreationTokens', 'cache_write_tokens')
  );
  const totalTokens = readNumber(readAlias(record, 'total_tokens', 'totalTokens'));
  const totalCost = readNumber(readAlias(record, 'total_cost', 'totalCost'));
  const averageLatencyMs = readNullableNumber(
    readAlias(record, 'average_latency_ms', 'averageLatencyMs', 'avgLatencyMs')
  );
  const zeroTokenCalls = readNumber(readAlias(record, 'zero_token_calls', 'zeroTokenCalls'));
  return {
    totalCalls,
    successCalls,
    failureCalls,
    successRate,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens,
    totalCost,
    averageLatencyMs,
    zeroTokenCalls,
    total_calls: totalCalls,
    success_calls: successCalls,
    failure_calls: failureCalls,
    success_rate: successRate,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    cached_tokens: cachedTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    total_tokens: totalTokens,
    total_cost: totalCost,
    average_cost_per_call: readNumber(
      readAlias(record, 'average_cost_per_call', 'averageCostPerCall')
    ),
    average_latency_ms: averageLatencyMs,
    p95_latency_ms: readNullableNumber(readAlias(record, 'p95_latency_ms', 'p95LatencyMs')),
    p95_ttft_ms: readNullableNumber(readAlias(record, 'p95_ttft_ms', 'p95TtftMs')),
    zero_token_calls: zeroTokenCalls,
    rpm_30m: readNumber(readAlias(record, 'rpm_30m', 'rpm30m')),
    tpm_30m: readNumber(readAlias(record, 'tpm_30m', 'tpm30m')),
    avg_daily_requests: readNumber(readAlias(record, 'avg_daily_requests', 'avgDailyRequests')),
    avg_daily_tokens: readNumber(readAlias(record, 'avg_daily_tokens', 'avgDailyTokens')),
    approx_tasks: readNumber(readAlias(record, 'approx_tasks', 'approxTasks')),
    approx_task_failures: readNumber(
      readAlias(record, 'approx_task_failures', 'approxTaskFailures')
    ),
    approx_task_success_rate: readNumber(
      readAlias(record, 'approx_task_success_rate', 'approxTaskSuccessRate')
    ),
    zero_token_models: readArray(readAlias(record, 'zero_token_models', 'zeroTokenModels')).map(
      (item) => String(item)
    ),
  } as MonitoringAnalyticsSummary;
};

const normalizeDashboardTrafficPoint = (raw: unknown): DashboardTrafficPoint => {
  const record = isRecord(raw) ? raw : {};
  return {
    bucketMs: readNumber(readAlias(record, 'bucket_ms', 'bucketMs')),
    calls: readNumber(record.calls),
    tokens: readNumber(record.tokens),
    success: readNumber(record.success),
    failure: readNumber(record.failure),
    failureRate: readNumber(readAlias(record, 'failure_rate', 'failureRate')),
  };
};

const normalizeDashboardHealthPoint = (raw: unknown): DashboardHealthPoint => {
  const record = isRecord(raw) ? raw : {};
  return {
    bucketMs: readNumber(readAlias(record, 'bucket_ms', 'bucketMs')),
    calls: readNumber(record.calls),
    tokens: readNumber(record.tokens),
    success: readNumber(record.success),
    failure: readNumber(record.failure),
    successRate: readNumber(readAlias(record, 'success_rate', 'successRate')),
    failureRate: readNumber(readAlias(record, 'failure_rate', 'failureRate')),
    tone: readString(record.tone) ?? '',
    intensity: readNumber(record.intensity),
    future: readBoolean(record.future),
  };
};

const normalizeDashboardRequestHealthTimeline = (
  raw: unknown
): DashboardRequestHealthTimeline => {
  const record = isRecord(raw) ? raw : {};
  return {
    fromMs: readNumber(readAlias(record, 'from_ms', 'fromMs')),
    toMs: readNumber(readAlias(record, 'to_ms', 'toMs')),
    bucketMs: readNumber(readAlias(record, 'bucket_ms', 'bucketMs')),
    totalCalls: readNumber(readAlias(record, 'total_calls', 'totalCalls')),
    successCalls: readNumber(readAlias(record, 'success_calls', 'successCalls')),
    failureCalls: readNumber(readAlias(record, 'failure_calls', 'failureCalls')),
    successRate: readNumber(readAlias(record, 'success_rate', 'successRate')),
    points: readArray(record.points).map(normalizeDashboardHealthPoint),
  };
};

const normalizeDashboardChannelHealth = (raw: unknown): DashboardChannelHealth => {
  const record = isRecord(raw) ? raw : {};
  return {
    source: readString(record.source) ?? '',
    sourceHash: readString(readAlias(record, 'source_hash', 'sourceHash')) ?? '',
    authIndex: readString(readAlias(record, 'auth_index', 'authIndex')) ?? '',
    authProviderSnapshot:
      readString(readAlias(record, 'auth_provider_snapshot', 'authProviderSnapshot')) ?? '',
    authLabelSnapshot:
      readString(readAlias(record, 'auth_label_snapshot', 'authLabelSnapshot')) ?? '',
    accountSnapshot: readString(readAlias(record, 'account_snapshot', 'accountSnapshot')) ?? '',
    apiKeyHash: readString(readAlias(record, 'api_key_hash', 'apiKeyHash')) ?? '',
    calls: readNumber(record.calls),
    failures: readNumber(record.failures),
    tokens: readNumber(record.tokens),
    cost: readNumber(record.cost),
    averageLatencyMs: readNullableNumber(
      readAlias(record, 'average_latency_ms', 'averageLatencyMs')
    ),
    successRate: readNumber(readAlias(record, 'success_rate', 'successRate')),
    failureRate: readNumber(readAlias(record, 'failure_rate', 'failureRate')),
    tone: readString(record.tone) ?? '',
  };
};

const normalizeDashboardProviderActivity = (raw: unknown): DashboardProviderActivity => {
  const record = isRecord(raw) ? raw : {};
  return {
    provider: readString(record.provider) ?? '',
    calls: readNumber(record.calls),
    successCalls: readNumber(readAlias(record, 'success_calls', 'successCalls')),
    failureCalls: readNumber(readAlias(record, 'failure_calls', 'failureCalls')),
    successRate: readNumber(readAlias(record, 'success_rate', 'successRate')),
    tokens: readNumber(record.tokens),
  };
};

export const normalizeMonitoringEvent = (raw: unknown): MonitoringAnalyticsEventRow => {
  const record = isRecord(raw) ? raw : {};
  const requestId = readString(readAlias(record, 'request_id', 'requestId'));
  const eventHash = readString(readAlias(record, 'event_hash', 'eventHash')) ?? '';
  const timestampMs = readNumber(readAlias(record, 'timestamp_ms', 'timestampMs'));
  const resolvedModel = readString(readAlias(record, 'resolved_model', 'resolvedModel'));
  const authIndex = readString(readAlias(record, 'auth_index', 'authIndex')) ?? '';
  const sourceHash = readString(readAlias(record, 'source_hash', 'sourceHash')) ?? '';
  const apiKeyHash = readString(readAlias(record, 'api_key_hash', 'apiKeyHash')) ?? '';
  const accountSnapshot =
    readString(readAlias(record, 'account_snapshot', 'accountSnapshot')) ?? '';
  const authLabelSnapshot =
    readString(readAlias(record, 'auth_label_snapshot', 'authLabelSnapshot')) ?? '';
  const authFileSnapshot = readString(readAlias(record, 'auth_file_snapshot', 'authFileSnapshot'));
  const authProviderSnapshot =
    readString(readAlias(record, 'auth_provider_snapshot', 'authProviderSnapshot')) ?? '';
  const authProjectIdSnapshot = readString(
    readAlias(record, 'auth_project_id_snapshot', 'authProjectIdSnapshot')
  );
  const inputTokens = readNumber(readAlias(record, 'input_tokens', 'inputTokens'));
  const outputTokens = readNumber(readAlias(record, 'output_tokens', 'outputTokens'));
  const cachedTokens = readNumber(readAlias(record, 'cached_tokens', 'cachedTokens'));
  const cacheReadTokens = readNumber(readAlias(record, 'cache_read_tokens', 'cacheReadTokens'));
  const cacheCreationTokens = readNumber(
    readAlias(record, 'cache_creation_tokens', 'cacheCreationTokens')
  );
  const reasoningTokens = readNumber(readAlias(record, 'reasoning_tokens', 'reasoningTokens'));
  const totalTokens = readNumber(readAlias(record, 'total_tokens', 'totalTokens'));
  const failStatusCode = readNullableNumber(readAlias(record, 'fail_status_code', 'failStatusCode'));
  const failSummary = readString(readAlias(record, 'fail_summary', 'failSummary'));
  const latencyMs = readNullableNumber(readAlias(record, 'latency_ms', 'latencyMs'));
  const headerTraceId = readString(readAlias(record, 'header_trace_id', 'headerTraceId'));
  return {
    id: readNullableNumber(record.id) ?? undefined,
    requestId,
    request_id: requestId,
    eventHash,
    event_hash: eventHash,
    timestampMs,
    timestamp_ms: timestampMs,
    provider: readString(record.provider),
    model: readString(record.model) ?? '',
    resolvedModel,
    resolved_model: resolvedModel,
    endpoint: readString(record.endpoint) ?? '',
    method: readString(record.method),
    path: readString(record.path),
    authIndex,
    auth_index: authIndex,
    source: readString(record.source),
    sourceHash,
    source_hash: sourceHash,
    apiKeyHash,
    api_key_hash: apiKeyHash,
    accountSnapshot,
    account_snapshot: accountSnapshot,
    authLabelSnapshot,
    auth_label_snapshot: authLabelSnapshot,
    authFileSnapshot,
    auth_file_snapshot: authFileSnapshot,
    authProviderSnapshot,
    auth_provider_snapshot: authProviderSnapshot,
    authProjectIdSnapshot,
    auth_project_id_snapshot: authProjectIdSnapshot,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    reasoning_tokens: reasoningTokens,
    totalTokens,
    total_tokens: totalTokens,
    failed: readBoolean(record.failed),
    failStatusCode,
    fail_status_code: failStatusCode,
    failSummary,
    fail_summary: failSummary,
    latencyMs,
    latency_ms: latencyMs,
    response_metadata: record.response_metadata as ResponseHeaderMetadata | undefined,
    header_quota_recover_at_ms: readNullableNumber(record.header_quota_recover_at_ms),
    header_quota_used_percent: readNullableNumber(record.header_quota_used_percent),
    header_quota_plan_type: readString(record.header_quota_plan_type),
    header_error_kind: readString(record.header_error_kind),
    header_error_code: readString(record.header_error_code),
    headerTraceId,
    header_trace_id: headerTraceId,
    reasoning_effort: readString(readAlias(record, 'reasoning_effort', 'reasoningEffort')),
    service_tier: readString(readAlias(record, 'service_tier', 'serviceTier')),
    executor_type: readString(readAlias(record, 'executor_type', 'executorType')),
    ttft_ms: readNullableNumber(readAlias(record, 'ttft_ms', 'ttftMs')),
  } satisfies MonitoringAnalyticsEventRow;
};

export const normalizeMonitoringEventsPage = (raw: unknown): MonitoringEventsPage => {
  const record = isRecord(raw) ? raw : {};
  const items = readArray(record.items ?? record.events).map(normalizeMonitoringEvent);
  const nextCursor = readString(readAlias(record, 'next_cursor', 'nextCursor')) ?? null;
  const nextBeforeMs = readNullableNumber(readAlias(record, 'next_before_ms', 'nextBeforeMs'));
  const nextBeforeId = readNullableNumber(readAlias(record, 'next_before_id', 'nextBeforeId'));
  const hasMore = readBoolean(readAlias(record, 'has_more', 'hasMore'));
  const totalCount =
    readAlias(record, 'total_count', 'totalCount') === undefined
      ? undefined
      : readNullableNumber(readAlias(record, 'total_count', 'totalCount'));
  return {
    items,
    nextCursor,
    next_cursor: nextCursor,
    nextBeforeMs,
    next_before_ms: nextBeforeMs,
    nextBeforeId,
    next_before_id: nextBeforeId,
    hasMore,
    has_more: hasMore,
    totalCount,
    total_count: totalCount,
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
    trafficTimeline: readArray(readAlias(record, 'traffic_timeline', 'trafficTimeline')).map(
      normalizeDashboardTrafficPoint
    ),
    todayRequestHealthTimeline: normalizeDashboardRequestHealthTimeline(
      readAlias(record, 'today_request_health_timeline', 'todayRequestHealthTimeline')
    ),
    providerActivity: readArray(readAlias(record, 'provider_activity', 'providerActivity')).map(
      normalizeDashboardProviderActivity
    ),
    channelHealth: readArray(readAlias(record, 'channel_health', 'channelHealth')).map(
      normalizeDashboardChannelHealth
    ),
    recentFailures: readArray(readAlias(record, 'recent_failures', 'recentFailures')).map(
      normalizeMonitoringEvent
    ),
  };
};

export const normalizeMonitoringAnalyticsResponse = (raw: unknown): MonitoringAnalyticsResponse => {
  const record = isRecord(raw) ? raw : {};
  const generatedAtMs = readNumber(readAlias(record, 'generated_at_ms', 'generatedAtMs'));
  const accountStats = readArray(readAlias(record, 'account_stats', 'accountStats'));
  const apiKeyStats = readArray(readAlias(record, 'api_key_stats', 'apiKeyStats'));
  const filterOptions = readAlias(record, 'filter_options', 'filterOptions');
  const events = record.events === undefined ? undefined : normalizeMonitoringEventsPage(record.events);
  const drilldownPreview =
    record.drilldown_preview === undefined
      ? undefined
      : normalizeMonitoringEventsPage(record.drilldown_preview);
  const recentFailures =
    readAlias(record, 'recent_failures', 'recentFailures') === undefined
      ? undefined
      : readArray(readAlias(record, 'recent_failures', 'recentFailures')).map(normalizeMonitoringEvent);
  return {
    ...record,
    generatedAtMs,
    generated_at_ms: generatedAtMs,
    granularity: readString(record.granularity) ?? 'hour',
    summary: record.summary === undefined ? undefined : normalizeMonitoringSummary(record.summary),
    summary_comparison: readAlias(record, 'summary_comparison', 'summaryComparison') as
      | MonitoringAnalyticsSummaryComparison
      | undefined,
    timeline: readArray(record.timeline) as MonitoringAnalyticsTimelinePoint[],
    hourly_distribution: readArray(
      readAlias(record, 'hourly_distribution', 'hourlyDistribution')
    ) as MonitoringAnalyticsHourlyPoint[],
    heatmap: readArray(record.heatmap) as MonitoringAnalyticsHeatmapPoint[],
    anomaly_points: readArray(
      readAlias(record, 'anomaly_points', 'anomalyPoints')
    ) as MonitoringAnalyticsAnomalyPoint[],
    model_share: readArray(readAlias(record, 'model_share', 'modelShare')) as MonitoringAnalyticsModelShareRow[],
    model_stats: readArray(readAlias(record, 'model_stats', 'modelStats')) as MonitoringAnalyticsModelStat[],
    channel_share: readArray(readAlias(record, 'channel_share', 'channelShare')) as MonitoringAnalyticsChannelShareRow[],
    failure_sources: readArray(readAlias(record, 'failure_sources', 'failureSources')) as MonitoringAnalyticsFailureSourceRow[],
    accountStats: accountStats as MonitoringAnalyticsAccountStatRow[],
    account_stats: accountStats as MonitoringAnalyticsAccountStatRow[],
    credential_stats: readArray(
      readAlias(record, 'credential_stats', 'credentialStats')
    ) as MonitoringAnalyticsCredentialStatRow[],
    credential_timeline: readArray(
      readAlias(record, 'credential_timeline', 'credentialTimeline')
    ) as MonitoringAnalyticsCredentialTimelinePoint[],
    apiKeyStats: apiKeyStats as MonitoringAnalyticsApiKeyStatRow[],
    api_key_stats: apiKeyStats as MonitoringAnalyticsApiKeyStatRow[],
    filterOptions: filterOptions as MonitoringAnalyticsFilterOptions | undefined,
    filter_options: filterOptions as MonitoringAnalyticsFilterOptions | undefined,
    task_buckets: readArray(readAlias(record, 'task_buckets', 'taskBuckets')) as MonitoringAnalyticsTaskBucketRow[],
    events,
    drilldown_preview: drilldownPreview,
    recentFailures,
    recent_failures: recentFailures,
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
  const record = isRecord(raw) ? raw : {};
  const price: ModelPrice = {
    ...record,
    prompt: readNumber(readAlias(record, 'prompt', 'input')),
    completion: readNumber(readAlias(record, 'completion', 'output')),
    cache: readNumber(readAlias(record, 'cache', 'cached')),
  };
  const cacheRead = readAlias(record, 'cache_read', 'cacheRead');
  const cacheCreation = readAlias(record, 'cache_creation', 'cacheCreation');
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
  const sampledEvents = readNumber(readAlias(record, 'sampled_events', 'sampledEvents'));
  const totalEvents = readNumber(readAlias(record, 'total_events', 'totalEvents'));
  return {
    sampledEvents,
    sampled_events: sampledEvents,
    totalEvents,
    total_events: totalEvents,
    truncated: readBoolean(record.truncated),
    models: readRecordArray(record.models).map((item) => ({
      model: readString(item.model) ?? '',
      calls: readNumber(item.calls),
      requested_calls: readNumber(readAlias(item, 'requested_calls', 'requestedCalls')),
      requestedCalls: readNumber(readAlias(item, 'requested_calls', 'requestedCalls')),
      resolved_calls: readNumber(readAlias(item, 'resolved_calls', 'resolvedCalls')),
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
  const sizeBytes = readNumber(readAlias(record, 'size_bytes', 'sizeBytes'));
  const receivedBytes = readNumber(readAlias(record, 'received_bytes', 'receivedBytes'));
  const chunkSizeBytes = readNumber(readAlias(record, 'chunk_size_bytes', 'chunkSizeBytes'));
  const createdAtMs = readNumber(readAlias(record, 'created_at_ms', 'createdAtMs'));
  const updatedAtMs = readNumber(readAlias(record, 'updated_at_ms', 'updatedAtMs'));
  const expiresAtMs = readNumber(readAlias(record, 'expires_at_ms', 'expiresAtMs'));
  return {
    id: readString(record.id) ?? '',
    filename: readString(record.filename) ?? '',
    status: readString(record.status) ?? 'uploading',
    sizeBytes,
    receivedBytes,
    chunkSizeBytes,
    createdAtMs,
    updatedAtMs,
    expiresAtMs,
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
  getInfo: (base: string): Promise<UsageServiceInfo> =>
    requestUsageApiData(
      () => apiClient.get(buildUsageServiceUrl(base, '/usage-service/info'), { timeout: USAGE_API_TIMEOUT_MS }),
      (payload) => (isRecord(payload) ? (payload as UsageServiceInfo) : {})
    ),
  getManagerConfig: (
    base: string,
    managementKey?: string
  ): Promise<ManagerConfigResponse> =>
    requestUsageApiData(
      () =>
        apiClient.get(buildUsageServiceUrl(base, '/usage-service/config'), {
          timeout: USAGE_API_TIMEOUT_MS,
          headers: authHeaders(managementKey),
        }),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          config: (isRecord(record.config) ? record.config : {}) as unknown as ManagerConfig,
          source: readString(record.source) as ManagerConfigResponse['source'],
        };
      }
    ),
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
  getUsage: (base: string, managementKey?: string): Promise<unknown> =>
    requestUsageApiData(
      () =>
        apiClient.get(buildUsageServiceUrl(base, '/v0/management/usage'), {
          timeout: USAGE_API_TIMEOUT_MS,
          headers: authHeaders(managementKey),
        }),
      (payload) => payload
    ),
  getModelPrices: (base: string, managementKey?: string): Promise<ModelPricesResponse> =>
    requestUsageApiData(
      () =>
        apiClient.get(buildUsageServiceUrl(base, '/v0/management/usage/model-prices'), {
          timeout: USAGE_API_TIMEOUT_MS,
          headers: authHeaders(managementKey),
        }),
      normalizeModelPricesResponse
    ),
  saveModelPrices: (
    base: string,
    prices: Record<string, unknown>,
    managementKey?: string
  ): Promise<ModelPricesResponse> =>
    requestUsageApiData(
      () =>
        apiClient.put(
          buildUsageServiceUrl(base, '/v0/management/usage/model-prices'),
          { prices },
          {
            timeout: USAGE_API_TIMEOUT_MS,
            headers: authHeaders(managementKey),
          }
        ),
      normalizeModelPricesResponse
    ),
  syncModelPrices: (
    base: string,
    managementKey?: string,
    models?: string[]
  ): Promise<ModelPriceSyncResponse> =>
    requestUsageApiData(
      () =>
        apiClient.post(
          buildUsageServiceUrl(base, '/v0/management/usage/model-prices/sync'),
          models ? { models } : {},
          {
            timeout: USAGE_API_TIMEOUT_MS,
            headers: authHeaders(managementKey),
          }
        ),
      normalizeModelPriceSyncResponse
    ),
  getApiKeyAliases: (base: string, managementKey?: string): Promise<ApiKeyAliasesResponse> =>
    requestUsageApiData(
      () =>
        apiClient.get(buildUsageServiceUrl(base, '/v0/management/usage/api-key-aliases'), {
          timeout: USAGE_API_TIMEOUT_MS,
          headers: authHeaders(managementKey),
        }),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return { items: readArray(record.items) as ApiKeyAlias[] };
      }
    ),
  saveApiKeyAliases: (
    base: string,
    items: ApiKeyAlias[],
    managementKey?: string,
    activeApiKeyHashes?: string[],
    allowOrphanAliasCleanup?: boolean
  ): Promise<ApiKeyAliasesResponse> =>
    requestUsageApiData(
      () =>
        apiClient.put(
          buildUsageServiceUrl(base, '/v0/management/usage/api-key-aliases'),
          {
            items,
            activeApiKeyHashes,
            allowOrphanAliasCleanup,
          },
          {
            timeout: USAGE_API_TIMEOUT_MS,
            headers: authHeaders(managementKey),
          }
        ),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return { items: readArray(record.items) as ApiKeyAlias[] };
      }
    ),
  exportUsage: (base: string, managementKey?: string): Promise<UsageExportResponse> =>
    requestUsageApiData(
      () =>
        apiClient.get<Blob>(buildUsageServiceUrl(base, '/v0/management/usage/export'), {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          headers: authHeaders(managementKey),
          responseType: 'blob',
        }),
      (payload) => ({
        blob: payload instanceof Blob ? payload : new Blob([payload as BlobPart]),
        filename: 'usage-events.jsonl',
      })
    ),
  importUsage: (
    base: string,
    payload: Blob | string,
    managementKey?: string
  ): Promise<UsageImportResponse> =>
    requestUsageApiData(
      () =>
        apiClient.post(buildUsageServiceUrl(base, '/v0/management/usage/import'), payload, {
          timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
          headers: authHeaders(managementKey),
        }),
      normalizeUsageImportResponse
    ),
  createUsageImportSession: (
    base: string,
    payload: UsageImportSessionCreateRequest,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession> =>
    requestUsageApiData(
      () =>
        apiClient.post(
          buildUsageServiceUrl(base, '/v0/management/usage/import-sessions'),
          serializeUsageImportSessionCreateRequest(payload),
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            headers: authHeaders(managementKey),
            signal,
          }
        ),
      (payload) => {
        if (isRecord(payload)) assertUsageImportSessionRedacted(payload);
        return normalizeUsageImportSession(payload);
      }
    ),
  getUsageImportSession: (
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession> =>
    requestUsageApiData(
      () =>
        apiClient.get(
          buildUsageServiceUrl(base, `/v0/management/usage/import-sessions/${encodeURIComponent(id)}`),
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            headers: authHeaders(managementKey),
            signal,
          }
        ),
      normalizeUsageImportSession
    ),
  uploadUsageImportSessionChunk: (
    base: string,
    id: string,
    offset: number,
    payload: Blob,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession> =>
    requestUsageApiData(
      () =>
        apiClient.put(
          buildUsageServiceUrl(base, `/v0/management/usage/import-sessions/${encodeURIComponent(id)}/chunk`),
          payload,
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            headers: authHeaders(managementKey),
            params: { offset },
            signal,
          }
        ),
      normalizeUsageImportSession
    ),
  completeUsageImportSession: (
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession> =>
    requestUsageApiData(
      () =>
        apiClient.post(
          buildUsageServiceUrl(base, `/v0/management/usage/import-sessions/${encodeURIComponent(id)}/complete`),
          undefined,
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            headers: authHeaders(managementKey),
            signal,
          }
        ),
      normalizeUsageImportSession
    ),
  cancelUsageImportSession: (
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession> =>
    requestUsageApiData(
      () =>
        apiClient.delete(
          buildUsageServiceUrl(base, `/v0/management/usage/import-sessions/${encodeURIComponent(id)}`),
          {
            timeout: USAGE_API_TRANSFER_TIMEOUT_MS,
            headers: authHeaders(managementKey),
            signal,
          }
        ),
      normalizeUsageImportSession
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

export const monitoringAnalyticsApi = {
  getHeaderSnapshots: (
    base: string,
    managementKey: string | undefined,
    params: { days?: number; limit?: number } = {}
  ): Promise<UsageHeaderSnapshotsResponse> =>
    requestUsageApiData(
      () =>
        apiClient.get(buildUsageServiceUrl(base, '/v0/management/usage/monitoring/header-snapshots'), {
          timeout: USAGE_API_TIMEOUT_MS,
          headers: authHeaders(managementKey),
          params,
        }),
      (payload) => {
        const record = isRecord(payload) ? payload : {};
        return {
          generated_at_ms: readNumber(readAlias(record, 'generated_at_ms', 'generatedAtMs')),
          from_ms: readNumber(readAlias(record, 'from_ms', 'fromMs')),
          to_ms: readNumber(readAlias(record, 'to_ms', 'toMs')),
          items: readArray(record.items) as UsageHeaderSnapshot[],
        };
      }
    ),
  getAnalytics: (
    base: string,
    managementKey: string | undefined,
    request: MonitoringAnalyticsRequest,
    signal?: AbortSignal
  ): Promise<MonitoringAnalyticsResponse> =>
    requestUsageApiData(
      () =>
        apiClient.post(
          buildUsageServiceUrl(base, '/v0/management/usage/monitoring/analytics'),
          serializeMonitoringAnalyticsRequest(request),
          {
            timeout: USAGE_API_TIMEOUT_MS,
            headers: authHeaders(managementKey),
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
