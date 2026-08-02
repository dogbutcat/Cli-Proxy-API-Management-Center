import type {
  DashboardSummary,
  ModelPrice,
  MonitoringAnalyticsRequest,
  MonitoringAnalyticsResponse,
  MonitoringEvent,
  UsageApiIssue,
  UsageApiResult,
  UsageCapabilities,
  UsageImportSession,
  UsageQueryStatus,
  UsageStatus,
} from '@/services/api/usageService';

export type MonitoringChannelMeta = {
  key: string;
  name: string;
  baseUrl: string;
  host: string;
  disabled: boolean;
  authIndices: string[];
  modelNames: string[];
};

export type MonitoringAuthMeta = {
  authIndex: string;
  label: string;
  generatedName: string;
  protocol: string;
  keyName: string;
  account: string;
  provider: string;
  status: string;
  disabled: boolean;
  unavailable: boolean;
  runtimeOnly: boolean;
  planType: string;
  updatedAt: string;
};

export type MonitoringTimeRange = 'today' | '7d' | '14d' | '30d' | 'all' | 'custom';

export type MonitoringCustomTimeRange = {
  startMs: number;
  endMs: number;
};

export type MonitoringStatusTone = 'good' | 'warn' | 'bad';

export type MonitoringStatusChip = {
  key: string;
  label: string;
  value: string;
  tone: MonitoringStatusTone;
};

export type MonitoringFilterOptions = {
  accountRows: MonitoringAccountRow[];
  apiKeyRows: MonitoringApiKeyRow[];
  providers: string[];
  models: string[];
  channels: string[];
  headerTraceIds: string[];
};

export type MonitoringAccountRow = {
  id: string;
  account: string;
  displayAccount: string;
  authLabels: string[];
  authIndices: string[];
  channels: string[];
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number | null;
  lastSeenAt: number;
};

export type MonitoringApiKeyRow = {
  id: string;
  apiKeyHash: string;
  apiKeyLabel: string;
  authLabels: string[];
  sourceLabels: string[];
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number | null;
  lastSeenAt: number;
};

export type MonitoringMetaPayload = {
  authFiles: MonitoringAuthMeta[];
  channels: MonitoringChannelMeta[];
  error: string;
};

export type MonitoringCanonicalApiState = {
  capabilities: UsageApiResult<UsageCapabilities>;
  status: UsageApiResult<UsageStatus>;
  dashboard?: UsageApiResult<DashboardSummary>;
  analytics?: UsageApiResult<MonitoringAnalyticsResponse>;
  importSession?: UsageApiResult<UsageImportSession>;
};

export type MonitoringCanonicalRequest = MonitoringAnalyticsRequest;
export type MonitoringCanonicalEvent = MonitoringEvent;
export type MonitoringCanonicalStatus = UsageQueryStatus;
export type MonitoringCanonicalIssue = UsageApiIssue;
export type MonitoringCanonicalModelPrice = ModelPrice;
