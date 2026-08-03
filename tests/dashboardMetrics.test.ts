import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { formatCompactNumber, formatPercent } from '../src/utils/format';
import type { DashboardSummary } from '../src/services/api/usageService';
import {
  buildProviderTrafficFromDashboardSummary,
  buildTrafficWindowFromDashboardSummary,
  getProviderKeyCounts,
} from '../src/features/dashboard/hooks/useDashboardOverview';
import {
  axisMax,
  formatRoutingStrategyLabel,
  getDashboardTodayStartMs,
  niceCeil,
  providerLabel,
  splitWindowMinutes,
  toneForSuccessRate,
} from '../src/features/dashboard/utils';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const routingStrategyTestLabels: Record<string, string> = {
  'basic_settings.routing_strategy_round_robin': 'RR',
  'basic_settings.routing_strategy_weighted_round_robin': 'WRR',
  'basic_settings.routing_strategy_fill_first': 'FF',
  'basic_settings.routing_strategy_seq_random': 'SR',
};

const tRouting = ((key: string, options?: { value?: string }) =>
  routingStrategyTestLabels[key] ?? `Unknown (${options?.value ?? ''})`) as TFunction;

const dashboardSummaryFixture = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  generatedAtMs: 1000,
  window: {
    todayStartMs: 0,
    nowMs: 1000,
    rolling30mStartMs: 0,
  },
  today: {
    totalCalls: 33,
    successCalls: 3,
    failureCalls: 30,
    successRate: 3 / 33,
    inputTokens: 1209,
    outputTokens: 213,
    reasoningTokens: 174,
    cachedTokens: 2672,
    cacheReadTokens: 0,
    cacheCreationTokens: 2672,
    totalTokens: 4268,
    totalCost: 0,
    averageLatencyMs: 1362,
    zeroTokenCalls: 0,
  },
  rolling30m: {
    rpm: 0,
    tpm: 0,
    totalCalls: 0,
    totalTokens: 0,
  },
  topModelsToday: [],
  trafficTimeline: [],
  todayRequestHealthTimeline: {
    fromMs: 0,
    toMs: 1_800_000,
    bucketMs: 600_000,
    totalCalls: 33,
    successCalls: 3,
    failureCalls: 30,
    successRate: 3 / 33,
    points: [
      {
        bucketMs: 0,
        calls: 10,
        tokens: 0,
        success: 0,
        failure: 10,
        successRate: 0,
        failureRate: 1,
        tone: 'bad',
        intensity: 1,
        future: false,
      },
      {
        bucketMs: 600_000,
        calls: 21,
        tokens: 1496,
        success: 1,
        failure: 20,
        successRate: 1 / 21,
        failureRate: 20 / 21,
        tone: 'bad',
        intensity: 1,
        future: false,
      },
      {
        bucketMs: 1_200_000,
        calls: 2,
        tokens: 2772,
        success: 2,
        failure: 0,
        successRate: 1,
        failureRate: 0,
        tone: 'good',
        intensity: 0.1,
        future: false,
      },
      {
        bucketMs: 1_800_000,
        calls: 5,
        tokens: 0,
        success: 5,
        failure: 0,
        successRate: 1,
        failureRate: 0,
        tone: 'future',
        intensity: 0,
        future: true,
      },
    ],
  },
  providerActivity: [
    {
      provider: 'opencode-go',
      calls: 4,
      successCalls: 1,
      failureCalls: 3,
      successRate: 0.25,
      tokens: 100,
    },
    {
      provider: 'antigravity',
      calls: 1,
      successCalls: 1,
      failureCalls: 0,
      successRate: 1,
      tokens: 50,
    },
  ],
  channelHealth: [
    {
      source: 'source-1',
      sourceHash: 'source-1',
      authIndex: 'auth-1',
      authProviderSnapshot: 'opencode-go',
      authLabelSnapshot: 'key-1',
      accountSnapshot: 'account-1',
      apiKeyHash: 'hash-1',
      calls: 4,
      failures: 3,
      tokens: 100,
      cost: 0,
      averageLatencyMs: 1000,
      successRate: 0.25,
      failureRate: 0.75,
      tone: 'bad',
    },
    {
      source: 'source-2',
      sourceHash: 'source-2',
      authIndex: 'auth-2',
      authProviderSnapshot: 'antigravity',
      authLabelSnapshot: 'key-2',
      accountSnapshot: 'account-2',
      apiKeyHash: 'hash-2',
      calls: 1,
      failures: 0,
      tokens: 50,
      cost: 0,
      averageLatencyMs: 800,
      successRate: 1,
      failureRate: 0,
      tone: 'good',
    },
  ],
  recentFailures: [],
  ...overrides,
});

describe('formatCompactNumber', () => {
  test('leaves values below one thousand alone', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(999)).toBe('999');
  });

  test('compacts with a single decimal and no redundant .0', () => {
    expect(formatCompactNumber(1000)).toBe('1K');
    expect(formatCompactNumber(1284)).toBe('1.3K');
    expect(formatCompactNumber(12_900)).toBe('12.9K');
    expect(formatCompactNumber(1_500_000)).toBe('1.5M');
  });

  test('carries into the next tier instead of rendering 1000K', () => {
    expect(formatCompactNumber(999_999)).toBe('1M');
    expect(formatCompactNumber(999_999_999)).toBe('1B');
  });

  test('keeps the sign and survives non-finite input', () => {
    expect(formatCompactNumber(-1500)).toBe('-1.5K');
    expect(formatCompactNumber(Number.NaN)).toBe('0');
  });
});

describe('formatPercent', () => {
  test('trims trailing zeros but keeps meaningful decimals', () => {
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(99.5)).toBe('99.5%');
    expect(formatPercent(0)).toBe('0%');
  });

  test('renders an em dash for non-finite rates', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('niceCeil', () => {
  test('rounds up onto the step ladder', () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(7)).toBe(8);
    expect(niceCeil(12)).toBe(15);
    expect(niceCeil(48)).toBe(50);
    expect(niceCeil(320)).toBe(400);
  });

  test('never returns zero, so bar heights cannot divide by zero', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
  });
});

describe('axisMax', () => {
  test('lands every gridline on a whole number', () => {
    // Peak 112 -> axis 120 (ticks 0/30/60/90/120), not a wasteful 200.
    expect(axisMax(112, 4)).toBe(120);
    expect(axisMax(7, 4)).toBe(8);
    expect(axisMax(1533, 4)).toBe(1600);
  });

  test('keeps the axis just above the peak', () => {
    for (const peak of [1, 3, 9, 17, 64, 112, 250, 999, 4321]) {
      const max = axisMax(peak, 4);
      expect(max).toBeGreaterThanOrEqual(peak);
      // The axis should not exceed twice the peak, or bars become too short.
      // Tiny peaks are constrained by a minimum step of 1, so the floor is the interval count.
      expect(max).toBeLessThanOrEqual(Math.max(4, peak * 2));
      // Every gridline must land on an integer.
      expect(Number.isInteger(max / 4)).toBe(true);
    }
  });

  test('degrades safely with no traffic', () => {
    expect(axisMax(0, 4)).toBe(4);
    expect(axisMax(-3, 4)).toBe(4);
  });
});

describe('toneForSuccessRate', () => {
  test('maps a rate onto a severity band', () => {
    expect(toneForSuccessRate(null)).toBe('idle');
    expect(toneForSuccessRate(100)).toBe('good');
    expect(toneForSuccessRate(95)).toBe('good');
    expect(toneForSuccessRate(94.9)).toBe('warning');
    expect(toneForSuccessRate(80)).toBe('warning');
    expect(toneForSuccessRate(79.9)).toBe('critical');
  });
});

describe('splitWindowMinutes', () => {
  test('splits the rolling window into hours and minutes', () => {
    expect(splitWindowMinutes(200)).toEqual({ hours: 3, minutes: 20 });
    expect(splitWindowMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitWindowMinutes(40)).toEqual({ hours: 0, minutes: 40 });
  });
});

describe('getDashboardTodayStartMs', () => {
  test('returns the local midnight for the dashboard summary query', () => {
    const instant = new Date(2026, 7, 2, 15, 30, 45, 120).getTime();
    const start = new Date(getDashboardTodayStartMs(instant));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(2);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });
});

describe('dashboard summary traffic', () => {
  test('uses usage summary health buckets instead of stale provider recent requests', () => {
    const traffic = buildTrafficWindowFromDashboardSummary(dashboardSummaryFixture());

    expect(traffic?.total).toBe(33);
    expect(traffic?.totalSuccess).toBe(3);
    expect(traffic?.totalFailure).toBe(30);
    expect(traffic?.successRate).toBeCloseTo((3 / 33) * 100);
    expect(traffic?.buckets).toHaveLength(3);
  });

  test('aggregates provider activity from provider rollup', () => {
    const providers = buildProviderTrafficFromDashboardSummary(dashboardSummaryFixture());

    expect(providers[0]).toMatchObject({
      id: 'opencode-go',
      credentials: 0,
      success: 1,
      failure: 3,
      total: 4,
      successRate: 25,
    });
    expect(providers[1]).toMatchObject({
      id: 'antigravity',
      success: 1,
      failure: 0,
      total: 1,
      successRate: 100,
    });
  });

  test('falls back to channel health when provider rollup is absent', () => {
    const providers = buildProviderTrafficFromDashboardSummary(
      dashboardSummaryFixture({ providerActivity: [] })
    );

    expect(providers[0]).toMatchObject({
      id: 'opencode-go',
      credentials: 1,
      success: 1,
      failure: 3,
      total: 4,
      successRate: 25,
    });
  });
});

describe('provider key counts', () => {
  test('includes native Interactions API keys in the dashboard total inputs', () => {
    const counts = getProviderKeyCounts({
      geminiApiKeys: [{ apiKey: 'gemini-key' }],
      interactionsApiKeys: [{ apiKey: 'interactions-1' }, { apiKey: 'interactions-2' }],
      codexApiKeys: [{ apiKey: 'codex-key' }],
    });

    expect(counts.interactions).toBe(2);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(4);
  });
});

describe('providerLabel', () => {
  test('uses the brand spelling for known providers', () => {
    expect(providerLabel('xai', 'Unattributed')).toBe('xAI');
    expect(providerLabel('aistudio', 'Unattributed')).toBe('AI Studio');
    expect(providerLabel('gemini-interactions', 'Unattributed')).toBe('Interactions API');
  });

  test('falls back to a capitalised id, and localises unknown', () => {
    expect(providerLabel('somenewbrand', 'Unattributed')).toBe('Somenewbrand');
    expect(providerLabel('unknown', 'Unattributed')).toBe('Unattributed');
    expect(providerLabel('', 'Unattributed')).toBe('Unattributed');
  });
});

describe('formatRoutingStrategyLabel', () => {
  test('formats all canonical strategies and safe aliases', () => {
    expect(formatRoutingStrategyLabel(tRouting, 'round-robin')).toBe('RR');
    expect(formatRoutingStrategyLabel(tRouting, 'weighted-round-robin')).toBe('WRR');
    expect(formatRoutingStrategyLabel(tRouting, 'fill-first')).toBe('FF');
    expect(formatRoutingStrategyLabel(tRouting, 'seq-random')).toBe('SR');
    expect(formatRoutingStrategyLabel(tRouting, 'sequential-random')).toBe('SR');
  });

  test('formats unknown strategies as an explicit raw diagnostic', () => {
    expect(formatRoutingStrategyLabel(tRouting, 'custom-routing')).toBe('Unknown (custom-routing)');
    expect(formatRoutingStrategyLabel(tRouting, '')).toBe('');
  });
});

describe('routing strategy locale keys', () => {
  test('exist in all supported locales touched by the routing badge', () => {
    const requiredKeys = [
      'routing_strategy_round_robin',
      'routing_strategy_weighted_round_robin',
      'routing_strategy_fill_first',
      'routing_strategy_seq_random',
      'routing_strategy_unknown',
    ] as const;
    const locales = [en, zhCN, zhTW, ru];

    for (const locale of locales) {
      for (const key of requiredKeys) {
        expect(locale.basic_settings[key]).toBeString();
        expect(locale.basic_settings[key].length).toBeGreaterThan(0);
      }
    }
  });
});
