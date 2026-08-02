import { TRAFFIC_BUCKET_MINUTES } from './types';
import type { TFunction } from 'i18next';
import type {
  DashboardSummary,
  UsageApiResult,
  UsageQueryStatus,
  UsageStatus,
} from '@/services/api/usageService';
import type {
  DashboardUsageSlice,
  DashboardUsageSliceIssue,
  DashboardUsageSliceState,
} from './types';
import type { CanonicalRoutingStrategy } from '@/types/config';
import { parseConfigRoutingStrategy } from '@/utils/routingStrategy';

const ROUTING_STRATEGY_LABEL_KEYS: Record<CanonicalRoutingStrategy, string> = {
  'round-robin': 'basic_settings.routing_strategy_round_robin',
  'fill-first': 'basic_settings.routing_strategy_fill_first',
  'weighted-round-robin': 'basic_settings.routing_strategy_weighted_round_robin',
  'seq-random': 'basic_settings.routing_strategy_seq_random',
};

export const ROUTING_STRATEGY_OPTION_VALUES: readonly CanonicalRoutingStrategy[] = [
  'round-robin',
  'weighted-round-robin',
  'fill-first',
  'seq-random',
];

export function formatRoutingStrategyLabel(
  t: TFunction,
  value: string | null | undefined
): string {
  const raw = value?.trim() ?? '';
  if (!raw) return '';

  const parsed = parseConfigRoutingStrategy(raw);
  if (parsed.canonical) {
    return t(ROUTING_STRATEGY_LABEL_KEYS[parsed.canonical]);
  }

  return t('basic_settings.routing_strategy_unknown', { value: raw });
}

export function getRoutingStrategyOptions(t: TFunction, currentValue?: string) {
  const options = ROUTING_STRATEGY_OPTION_VALUES.map((value) => ({
    value,
    label: t(ROUTING_STRATEGY_LABEL_KEYS[value]),
  }));

  const raw = currentValue?.trim() ?? '';
  if (!raw) return options;

  const parsed = parseConfigRoutingStrategy(raw);
  if (parsed.known || options.some((option) => option.value === raw)) return options;

  return [...options, { value: raw, label: formatRoutingStrategyLabel(t, raw) }];
}

/** Provider display names are proper nouns, so they stay outside i18n. */
const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  'gemini-interactions': 'Interactions API',
  aistudio: 'AI Studio',
  codex: 'Codex',
  claude: 'Claude',
  xai: 'xAI',
  vertex: 'Vertex AI',
  openai: 'OpenAI Compatible',
  'openai-compatibility': 'OpenAI Compatible',
  qwen: 'Qwen',
  kimi: 'Kimi',
  iflow: 'iFlow',
  antigravity: 'Antigravity',
};

/** Resolve a provider label; callers localize `unknown`, unknown ids fall back to capitalization. */
export function providerLabel(id: string, unknownLabel: string): string {
  if (id === 'unknown' || !id) return unknownLabel;
  return PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export interface WindowParts {
  hours: number;
  minutes: number;
}

/** Split window minutes into hours/minutes for i18n interpolation. */
export function splitWindowMinutes(totalMinutes: number): WindowParts {
  const safe = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/** Bucket count to covered minutes. */
export function bucketsToMinutes(bucketCount: number): number {
  return bucketCount * TRAFFIC_BUCKET_MINUTES;
}

export type MeterTone = 'good' | 'warning' | 'critical' | 'idle';

/** Success rate to severity. The value remains visible; color is only an aid. */
export function toneForSuccessRate(rate: number | null): MeterTone {
  if (rate === null) return 'idle';
  if (rate >= 95) return 'good';
  if (rate >= 80) return 'warning';
  return 'critical';
}

/** Finer than a 1/2/5 ladder, so a peak like 112 does not jump to a 200 axis. */
const STEP_LADDER = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

/** Round a value up to a readable ladder step times 10^n. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = STEP_LADDER.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

/** Round the y-axis step first, so gridlines stay integral without overshooting the peak. */
export function axisMax(peak: number, intervals: number): number {
  if (peak <= 0 || intervals <= 0) return Math.max(1, intervals);
  const step = Math.max(1, Math.ceil(niceCeil(peak / intervals)));
  return step * intervals;
}

export const getDashboardTodayStartMs = (nowMs: number): number => {
  const date = new Date(nowMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const createEmptyDashboardUsageSlice = (): DashboardUsageSlice => ({
  summary: null,
  status: null,
  summaryState: 'idle',
  statusState: 'idle',
  loading: false,
  refreshing: false,
  partial: false,
  stale: false,
  unsupported: false,
  issues: [],
  updatedAtMs: null,
});

export const dashboardUsageHasLastGoodData = (slice: DashboardUsageSlice): boolean =>
  slice.summary !== null || slice.status !== null;

export const markDashboardUsageLoading = (slice: DashboardUsageSlice): DashboardUsageSlice => ({
  ...slice,
  loading: !dashboardUsageHasLastGoodData(slice),
  refreshing: dashboardUsageHasLastGoodData(slice),
  issues: [],
});

export const markDashboardUsageDisconnected = (
  slice: DashboardUsageSlice
): DashboardUsageSlice => ({
  ...slice,
  loading: false,
  refreshing: false,
  stale: dashboardUsageHasLastGoodData(slice) ? true : slice.stale,
});

type DashboardUsageSettled<T> = PromiseSettledResult<UsageApiResult<T>>;

export interface DashboardUsageSliceResults {
  summary: DashboardUsageSettled<DashboardSummary>;
  status: DashboardUsageSettled<UsageStatus>;
  updatedAtMs: number;
}

const issuesFromQueryStatus = (
  source: DashboardUsageSliceIssue['source'],
  status?: UsageQueryStatus
): DashboardUsageSliceIssue[] => {
  if (!status) return [];
  return [...status.errors, ...status.warnings].map((issue) => ({ ...issue, source }));
};

const issueFromMessage = (
  source: DashboardUsageSliceIssue['source'],
  kind: string | undefined,
  message: string
): DashboardUsageSliceIssue => ({ source, kind, message });

const resultIssue = <T>(
  source: DashboardUsageSliceIssue['source'],
  result: DashboardUsageSettled<T>
): DashboardUsageSliceIssue | null => {
  if (result.status === 'rejected') {
    const reason = result.reason;
    return issueFromMessage(
      source,
      'transport',
      reason instanceof Error ? reason.message : 'Usage API request failed.'
    );
  }

  if (result.value.kind === 'error') {
    return issueFromMessage(source, result.value.code ?? 'error', result.value.message);
  }

  if (result.value.kind === 'unsupported') {
    return issueFromMessage(source, result.value.code ?? 'unsupported', result.value.message);
  }

  return null;
};

const resultState = <T>(
  result: DashboardUsageSettled<T>,
  okState: DashboardUsageSliceState = 'ok'
): DashboardUsageSliceState => {
  if (result.status === 'rejected') return 'error';
  if (result.value.kind === 'success') return okState;
  if (result.value.kind === 'empty') return 'empty';
  if (result.value.kind === 'unsupported') return 'unsupported';
  return 'error';
};

const collectStatusFlags = (...statuses: Array<UsageQueryStatus | undefined>) =>
  statuses.reduce(
    (flags, status) => ({
      partial: flags.partial || Boolean(status?.partial),
      stale: flags.stale || Boolean(status?.stale),
    }),
    { partial: false, stale: false }
  );

const queryStatusFromResult = <T extends { status?: UsageQueryStatus }>(
  result: DashboardUsageSettled<T>
): UsageQueryStatus | undefined => {
  if (result.status === 'rejected') return undefined;
  const value = result.value;
  if (value.kind === 'success' || value.kind === 'empty') {
    return value.status ?? value.data.status;
  }
  if (value.kind === 'unsupported') {
    return value.status;
  }
  return undefined;
};

export const reduceDashboardUsageSlice = (
  previous: DashboardUsageSlice,
  results: DashboardUsageSliceResults
): DashboardUsageSlice => {
  let summary = previous.summary;
  let status = previous.status;
  const issues: DashboardUsageSliceIssue[] = [];
  let unsupported = false;

  const summaryState = resultState(results.summary);
  if (results.summary.status === 'fulfilled') {
    const result = results.summary.value;
    if (result.kind === 'success' || result.kind === 'empty') {
      summary = result.data;
      issues.push(...issuesFromQueryStatus('summary', result.status ?? result.data.status));
    } else {
      unsupported ||= result.kind === 'unsupported';
    }
  }

  const statusState = resultState(results.status);
  if (results.status.status === 'fulfilled') {
    const result = results.status.value;
    if (result.kind === 'success' || result.kind === 'empty') {
      status = result.data;
      issues.push(...issuesFromQueryStatus('status', result.status ?? result.data.status));
    } else {
      unsupported ||= result.kind === 'unsupported';
    }
  }

  const summaryIssue = resultIssue('summary', results.summary);
  const statusIssue = resultIssue('status', results.status);
  if (summaryIssue) issues.push(summaryIssue);
  if (statusIssue) issues.push(statusIssue);

  const flags = collectStatusFlags(
    queryStatusFromResult(results.summary),
    queryStatusFromResult(results.status),
    status?.status
  );

  const hasError = summaryState === 'error' || statusState === 'error';

  return {
    summary,
    status,
    summaryState,
    statusState,
    loading: false,
    refreshing: false,
    partial: flags.partial,
    stale: flags.stale || (hasError && (summary !== null || status !== null)),
    unsupported,
    issues,
    updatedAtMs: results.updatedAtMs,
  };
};
