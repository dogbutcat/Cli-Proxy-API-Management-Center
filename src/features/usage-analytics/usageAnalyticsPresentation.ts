import { formatCompactNumber, formatPercent, formatUnixTimestamp } from '@/utils/format';
import type {
  UsageAnalyticsDataState,
  UsageAnalyticsIssue,
  UsageAnalyticsModel,
  UsageAnalyticsStatRow,
} from './usageAnalyticsModel';
import type { UsageAnalyticsTab } from './usageAnalyticsUiState';

export type UsageAnalyticsBannerTone = 'info' | 'warning' | 'danger' | 'neutral';

export type UsageAnalyticsBanner = {
  key: string;
  tone: UsageAnalyticsBannerTone;
  text: string;
};

export type UsageAnalyticsMetricCard = {
  key: string;
  label: string;
  value: string;
  note: string;
};

export type UsageAnalyticsSurfaceDescriptor = {
  key: UsageAnalyticsTab;
  label: string;
  ariaLabel: string;
};

export const USAGE_ANALYTICS_SURFACE_DESCRIPTORS: UsageAnalyticsSurfaceDescriptor[] = [
  { key: 'overview', label: 'Overview', ariaLabel: 'Usage overview surface' },
  { key: 'trend', label: 'Trend', ariaLabel: 'Usage trend surface' },
  { key: 'models', label: 'Model', ariaLabel: 'Model usage surface' },
  { key: 'clientKeys', label: 'Client Key', ariaLabel: 'Client key usage surface' },
  { key: 'credentials', label: 'Credential', ariaLabel: 'Credential usage surface' },
  { key: 'heatmap', label: 'Heatmap', ariaLabel: 'Usage heatmap surface' },
];

const MONEY_FORMATTER = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
});

const formatMoney = (value: number | null): string =>
  value === null ? 'No price' : MONEY_FORMATTER.format(value);

const formatLatency = (value: number | null): string =>
  value === null ? '-' : `${Math.round(value).toLocaleString()} ms`;

const stateLabel: Record<UsageAnalyticsDataState, string> = {
  idle: 'Idle',
  loading: 'Loading',
  refreshing: 'Refreshing',
  ok: 'Ready',
  empty: 'Empty',
  unsupported: 'Unsupported',
  error: 'Error',
  unavailable: 'Unavailable',
};

export const formatUsageAnalyticsState = (state: UsageAnalyticsDataState): string =>
  stateLabel[state] ?? state;

export const buildUsageAnalyticsMetricCards = (
  model: UsageAnalyticsModel
): UsageAnalyticsMetricCard[] => {
  const summary = model.overview.summary;
  return [
    {
      key: 'calls',
      label: 'Calls',
      value: formatCompactNumber(summary?.totalCalls ?? 0),
      note: `${formatCompactNumber(summary?.failureCalls ?? 0)} failed`,
    },
    {
      key: 'tokens',
      label: 'Tokens',
      value: formatCompactNumber(summary?.totalTokens ?? 0),
      note: `${formatCompactNumber(summary?.zeroTokenCalls ?? 0)} zero-token calls`,
    },
    {
      key: 'cost',
      label: 'Cost',
      value: formatMoney(summary?.totalCost ?? 0),
      note: model.flags.missingPrice ? 'Missing price data' : 'Priced rows only',
    },
    {
      key: 'success',
      label: 'Success rate',
      value: formatPercent(summary?.successRate ?? 0),
      note: `Latency ${formatLatency(summary?.averageLatencyMs ?? null)}`,
    },
  ];
};

const issueText = (issue: UsageAnalyticsIssue): string =>
  `${issue.source}${issue.kind ? `/${issue.kind}` : ''}: ${issue.message}`;

export const buildUsageAnalyticsBanners = (model: UsageAnalyticsModel): UsageAnalyticsBanner[] => {
  const banners: UsageAnalyticsBanner[] = [];
  if (model.flags.unsupported) {
    banners.push({
      key: 'unsupported',
      tone: 'warning',
      text: 'Usage analytics are unsupported by this backend.',
    });
  }
  if (model.flags.error) {
    banners.push({
      key: 'error',
      tone: 'danger',
      text: model.issues[0] ? issueText(model.issues[0]) : 'Usage analytics request failed.',
    });
  }
  if (model.flags.partial) {
    banners.push({ key: 'partial', tone: 'warning', text: 'Partial aggregate data returned.' });
  }
  if (model.flags.stale) {
    banners.push({ key: 'stale', tone: 'warning', text: 'Showing stale aggregate data.' });
  }
  if (model.flags.empty) {
    banners.push({ key: 'empty', tone: 'neutral', text: 'No usage matched the current filters.' });
  }
  if (model.flags.unavailable) {
    banners.push({
      key: 'unavailable',
      tone: 'info',
      text: 'Some aggregate surfaces were not returned by the API.',
    });
  }
  if (model.flags.zeroToken) {
    banners.push({ key: 'zero-token', tone: 'info', text: 'Zero-token calls are present.' });
  }
  if (model.flags.missingPrice) {
    banners.push({ key: 'missing-price', tone: 'info', text: 'Some rows have missing prices.' });
  }
  return banners;
};

export const rowTokensText = (row: UsageAnalyticsStatRow): string =>
  formatCompactNumber(row.totalTokens);

export const rowCostText = (row: UsageAnalyticsStatRow): string => formatMoney(row.totalCost);

export const rowRateText = (row: UsageAnalyticsStatRow): string =>
  row.successRate === null ? '-' : formatPercent(row.successRate);

export const rowLatencyText = (row: UsageAnalyticsStatRow): string =>
  formatLatency(row.averageLatencyMs);

export const usageAnalyticsUpdatedText = (model: UsageAnalyticsModel): string =>
  model.updatedAtMs ? `Updated ${formatUnixTimestamp(model.updatedAtMs)}` : 'Not updated';
