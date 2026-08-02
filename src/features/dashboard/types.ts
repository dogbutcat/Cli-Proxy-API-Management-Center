import type { RecentRequestBucket } from '@/utils/recentRequests';
import type { DashboardSummary, UsageApiIssue, UsageStatus } from '@/services/api/usageService';

/** Each traffic bucket covers 10 minutes; the backend returns 20 buckets. */
export const TRAFFIC_BUCKET_MINUTES = 10;

/** Aggregated traffic window. */
export interface TrafficWindow {
  buckets: RecentRequestBucket[];
  totalSuccess: number;
  totalFailure: number;
  total: number;
  /** 0-100; null when the window has no requests. */
  successRate: number | null;
  /** Largest single-bucket request count, used for the chart y-axis. */
  peakTotal: number;
  /** Bucket index for the peak, or -1 when no data exists. */
  peakIndex: number;
  /** Number of buckets with at least one request. */
  activeBuckets: number;
  /** Window size in minutes. */
  windowMinutes: number;
}

/** Traffic slice for one provider. */
export interface ProviderTraffic {
  id: string;
  credentials: number;
  success: number;
  failure: number;
  total: number;
  successRate: number | null;
  buckets: RecentRequestBucket[];
}

/** Credential health summary. */
export interface CredentialHealth {
  total: number;
  active: number;
  disabled: number;
  unavailable: number;
  /** Credential counts grouped by provider type, sorted by count descending. */
  byType: Array<{ type: string; count: number }>;
}

/** Raw values for the top metric cards. */
export interface DashboardCounts {
  managementKeys: number | null;
  providerKeys: number | null;
  credentials: number | null;
  models: number | null;
}

export type DashboardUsageSliceState = 'idle' | 'ok' | 'empty' | 'unsupported' | 'error';

export interface DashboardUsageSliceIssue extends UsageApiIssue {
  source: 'summary' | 'status';
}

export interface DashboardUsageSlice {
  summary: DashboardSummary | null;
  status: UsageStatus | null;
  summaryState: DashboardUsageSliceState;
  statusState: DashboardUsageSliceState;
  loading: boolean;
  refreshing: boolean;
  partial: boolean;
  stale: boolean;
  unsupported: boolean;
  issues: DashboardUsageSliceIssue[];
  updatedAtMs: number | null;
}
