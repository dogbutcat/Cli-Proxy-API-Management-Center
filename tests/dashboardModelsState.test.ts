import { describe, expect, test } from 'bun:test';
import type {
  DashboardSummary,
  UsageApiResult,
  UsageStatus,
} from '../src/services/api/usageService';
import {
  createEmptyDashboardUsageSlice,
  dashboardUsageHasLastGoodData,
  markDashboardUsageLoading,
  reduceDashboardUsageSlice,
} from '../src/features/dashboard/utils';

const fulfilled = <T>(value: UsageApiResult<T>): PromiseFulfilledResult<UsageApiResult<T>> => ({
  status: 'fulfilled',
  value,
});

const rejected = (reason: unknown): PromiseRejectedResult => ({
  status: 'rejected',
  reason,
});

const baseSummary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  generatedAtMs: 1000,
  window: {
    todayStartMs: 0,
    nowMs: 1000,
    rolling30mStartMs: 0,
  },
  today: {
    totalCalls: 12,
    successCalls: 10,
    failureCalls: 2,
    successRate: 83.3,
    inputTokens: 100,
    outputTokens: 50,
    reasoningTokens: 7,
    cachedTokens: 3,
    cacheReadTokens: 2,
    cacheCreationTokens: 1,
    totalTokens: 163,
    totalCost: 0.12,
    averageLatencyMs: 250,
    zeroTokenCalls: 0,
  },
  rolling30m: {
    rpm: 2,
    tpm: 25,
    totalCalls: 6,
    totalTokens: 75,
  },
  topModelsToday: [
    {
      model: 'gpt-local',
      calls: 8,
      tokens: 100,
      cost: 0.08,
      successRate: 100,
    },
  ],
  recentFailures: [
    {
      eventHash: 'failure-1',
      timestampMs: 900,
      model: 'gpt-local',
      endpoint: '/v1/chat/completions',
      authIndex: 'auth-1',
      sourceHash: 'source-1',
      totalTokens: 0,
      failed: true,
      failStatusCode: 429,
      failSummary: 'quota',
    },
  ],
  ...overrides,
});

const baseStatus = (overrides: Partial<UsageStatus> = {}): UsageStatus => ({
  service: 'usage',
  source: 'sqlite',
  events: 20,
  deadLetters: 1,
  dbSizeBytes: 4096,
  collector: {
    collector: 'local',
    mode: 'async',
    queueSize: 0,
    totalInserted: 18,
    totalDropped: 0,
    totalSkipped: 2,
    lastInsertedAt: 1000,
  },
  ...overrides,
});

describe('dashboard usage slice state', () => {
  test('marks loading as refresh when last-good data exists', () => {
    const previous = reduceDashboardUsageSlice(createEmptyDashboardUsageSlice(), {
      summary: fulfilled({ kind: 'success', data: baseSummary() }),
      status: fulfilled({ kind: 'success', data: baseStatus() }),
      updatedAtMs: 1000,
    });

    const loading = markDashboardUsageLoading(previous);

    expect(dashboardUsageHasLastGoodData(loading)).toBe(true);
    expect(loading.loading).toBe(false);
    expect(loading.refreshing).toBe(true);
  });

  test('preserves summary when the status slice fails independently', () => {
    const previous = reduceDashboardUsageSlice(createEmptyDashboardUsageSlice(), {
      summary: fulfilled({ kind: 'success', data: baseSummary() }),
      status: fulfilled({ kind: 'success', data: baseStatus({ events: 20 }) }),
      updatedAtMs: 1000,
    });

    const next = reduceDashboardUsageSlice(previous, {
      summary: fulfilled({ kind: 'success', data: baseSummary({ generatedAtMs: 2000 }) }),
      status: rejected(new Error('status unavailable')),
      updatedAtMs: 2000,
    });

    expect(next.summary?.generatedAtMs).toBe(2000);
    expect(next.status?.events).toBe(20);
    expect(next.statusState).toBe('error');
    expect(next.stale).toBe(true);
  });

  test('preserves status when the summary slice returns unsupported', () => {
    const previous = reduceDashboardUsageSlice(createEmptyDashboardUsageSlice(), {
      summary: fulfilled({ kind: 'success', data: baseSummary({ generatedAtMs: 1000 }) }),
      status: fulfilled({ kind: 'success', data: baseStatus({ events: 20 }) }),
      updatedAtMs: 1000,
    });

    const next = reduceDashboardUsageSlice(previous, {
      summary: fulfilled({
        kind: 'unsupported',
        message: 'dashboard summary unsupported',
      }),
      status: fulfilled({ kind: 'success', data: baseStatus({ events: 21 }) }),
      updatedAtMs: 2000,
    });

    expect(next.summary?.generatedAtMs).toBe(1000);
    expect(next.status?.events).toBe(21);
    expect(next.summaryState).toBe('unsupported');
    expect(next.unsupported).toBe(true);
  });

  test('keeps model and failure arrays as page-facing dashboard data', () => {
    const next = reduceDashboardUsageSlice(createEmptyDashboardUsageSlice(), {
      summary: fulfilled({ kind: 'success', data: baseSummary() }),
      status: fulfilled({ kind: 'success', data: baseStatus() }),
      updatedAtMs: 1000,
    });

    expect(next.summary?.topModelsToday).toHaveLength(1);
    expect(next.summary?.topModelsToday[0]?.model).toBe('gpt-local');
    expect(next.summary?.recentFailures[0]?.failStatusCode).toBe(429);
  });
});
