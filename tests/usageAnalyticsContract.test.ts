import { describe, expect, test } from 'bun:test';
import { deriveMonitoringSourceIdentity } from '../src/features/monitoring/model/sourceDisplay';
import { buildUsageAnalyticsModel } from '../src/features/usage-analytics/usageAnalyticsModel';
import {
  buildUsageAnalyticsComparisonRequest,
  buildUsageAnalyticsDrilldownRequest,
  buildUsageAnalyticsRequest,
  createDefaultUsageAnalyticsUiState,
  type UsageAnalyticsUiState,
} from '../src/features/usage-analytics/usageAnalyticsUiState';
import { formatUsageAnalyticsState } from '../src/features/usage-analytics/usageAnalyticsPresentation';
import type { MonitoringAnalyticsResponse, UsageApiResult } from '../src/services/api/usageService';

const analyticsFixture = {
  generatedAtMs: 1_775_000_000_000,
  granularity: 'hour',
  summary: {
    totalCalls: 7,
    successCalls: 5,
    failureCalls: 2,
    successRate: 71.4,
    inputTokens: 20,
    outputTokens: 22,
    reasoningTokens: 0,
    cachedTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 42,
    totalCost: 0,
    averageLatencyMs: null,
    zeroTokenCalls: 1,
  },
  trend: [
    {
      bucket_start_ms: 1_774_999_000_000,
      total_calls: 0,
      failure_calls: 0,
      total_tokens: 0,
      total_cost: 0,
    },
  ],
  model_stats: [
    {
      model: 'claude-sonnet-4',
      provider: 'opencode-go',
      total_calls: 3,
      failure_calls: 1,
      total_tokens: 42,
      total_cost: 0,
      price_state: 'missing-price',
    },
    {
      model: 'zero-token-model',
      provider: 'openai',
      total_calls: 1,
      failure_calls: 1,
      total_tokens: 0,
      total_cost: 0,
    },
  ],
  provider_usage: [
    {
      provider: 'opencode-go',
      workspace: 'workspace-a',
      total_calls: 3,
      failure_calls: 1,
      total_tokens: 42,
      total_cost: 0,
    },
  ],
  accountStats: [
    {
      auth_index: 'entry-a',
      provider: 'opencode-go',
      label: 'OpenCode Workspace',
      source_payload: {
        provider: 'opencode-go',
        entry: 'entry-a',
        workspace: 'workspace-a',
        protocol: 'codex',
        account: 'unsafe-account-secret',
        'api-key': 'unsafe-api-key-secret',
        cookie: 'unsafe-cookie-secret',
      },
      total_calls: 3,
      failure_calls: 1,
      total_tokens: 42,
      total_cost: 0,
    },
  ],
  apiKeyStats: [
    {
      api_key_hash: 'abcdef123456',
      api_key_label: 'client-a',
      total_calls: 4,
      failure_calls: 1,
      total_tokens: 0,
      total_cost: 0,
    },
  ],
  heatmap: [
    {
      weekday: 2,
      hour: 9,
      total_calls: 0,
      total_tokens: 0,
    },
  ],
} satisfies MonitoringAnalyticsResponse & Record<string, unknown>;

const successResult: UsageApiResult<MonitoringAnalyticsResponse> = {
  kind: 'success',
  data: analyticsFixture,
  status: {
    state: 'ok',
    hasData: true,
    partial: true,
    stale: true,
    errors: [],
    warnings: [{ component: 'pricing', kind: 'missing', message: 'one model has no price' }],
  },
};

describe('usage analytics contract', () => {
  test('builds canonical server aggregate requests with filters and granularity', () => {
    const state: UsageAnalyticsUiState = {
      ...createDefaultUsageAnalyticsUiState(1_775_000_000_000, 'UTC'),
      fromMs: 1_774_900_000_000,
      toMs: 1_775_000_000_000,
      granularity: 'day',
      filters: {
        models: ['claude-sonnet-4'],
        providers: ['opencode-go'],
        authIndices: ['entry-a'],
        apiKeyHashes: ['abcdef123456'],
        includeFailed: false,
        failedOnly: true,
        searchQuery: 'workspace-a',
        searchApiKeyHash: 'abcdef123456',
      },
    };

    expect(buildUsageAnalyticsRequest(state)).toEqual({
      fromMs: 1_774_900_000_000,
      toMs: 1_775_000_000_000,
      nowMs: 1_775_000_000_000,
      timeZone: 'UTC',
      searchQuery: 'workspace-a',
      searchApiKeyHash: 'abcdef123456',
      filters: {
        models: ['claude-sonnet-4'],
        providers: ['opencode-go'],
        accounts: undefined,
        credentialIds: undefined,
        authFiles: undefined,
        authIndices: ['entry-a'],
        apiKeyHashes: ['abcdef123456'],
        sourceHashes: undefined,
        projectIds: undefined,
        requestTypes: undefined,
        headerErrorKinds: undefined,
        headerErrorCodes: undefined,
        headerQuotaPlans: undefined,
        headerTraceIds: undefined,
        includeFailed: false,
        failedOnly: true,
        minLatencyMs: undefined,
        cacheStatus: undefined,
      },
      include: {
        summary: true,
        summaryProfile: 'full',
        accountStats: true,
        apiKeyStats: true,
        filterOptions: true,
        filterSelectors: true,
        recentFailures: 10,
        granularity: 'day',
        eventsPage: undefined,
      },
    });
  });

  test('keeps comparison and drilldown absence distinct from API errors', () => {
    const base = createDefaultUsageAnalyticsUiState(1_775_000_000_000, 'UTC');
    const withComparison: UsageAnalyticsUiState = {
      ...base,
      comparison: {
        enabled: true,
        fromMs: base.fromMs - (base.toMs - base.fromMs),
        toMs: base.fromMs,
      },
    };
    const withDrilldown: UsageAnalyticsUiState = {
      ...withComparison,
      drilldown: {
        enabled: true,
        limit: 50,
        beforeMs: null,
        beforeId: null,
        target: {
          surface: 'model',
          id: 'claude-sonnet-4',
          filters: { models: ['claude-sonnet-4'] },
        },
      },
    };

    expect(buildUsageAnalyticsComparisonRequest(base)).toBeNull();
    expect(buildUsageAnalyticsComparisonRequest(withComparison)?.fromMs).toBe(
      base.fromMs - (base.toMs - base.fromMs)
    );
    expect(buildUsageAnalyticsDrilldownRequest(base)).toBeNull();
    expect(buildUsageAnalyticsDrilldownRequest(withDrilldown)?.filters?.models).toEqual([
      'claude-sonnet-4',
    ]);

    expect(buildUsageAnalyticsModel({ analytics: successResult }).comparison.state).toBe(
      'unavailable'
    );
    expect(
      buildUsageAnalyticsModel({
        analytics: successResult,
        comparison: { kind: 'error', message: 'boom' },
      }).comparison
    ).toMatchObject({ state: 'error', reason: 'error' });
    expect(buildUsageAnalyticsModel({ analytics: successResult }).drilldown.state).toBe(
      'unavailable'
    );
    expect(
      buildUsageAnalyticsModel({
        analytics: successResult,
        drilldown: { kind: 'error', message: 'boom' },
      }).drilldown.state
    ).toBe('error');
  });

  test('builds six analysis surfaces from server aggregates', () => {
    const model = buildUsageAnalyticsModel({
      analytics: successResult,
      comparison: {
        kind: 'success',
        data: {
          generatedAtMs: 1,
          granularity: 'hour',
          summary: { ...analyticsFixture.summary, totalCalls: 2, totalTokens: 10, totalCost: 1 },
        },
      },
    });

    expect(model.surfaces).toMatchObject({
      overview: 'ok',
      trend: 'ok',
      models: 'ok',
      clientKeys: 'ok',
      credentials: 'ok',
      heatmap: 'ok',
      providerUsage: 'ok',
    });
    expect(model.flags.partial).toBe(true);
    expect(model.flags.stale).toBe(true);
    expect(model.flags.zeroToken).toBe(true);
    expect(model.flags.missingPrice).toBe(true);
    expect(model.models.map((row) => [row.label, row.priceState])).toEqual([
      ['claude-sonnet-4', 'missing'],
      ['zero-token-model', 'priced'],
    ]);
    expect(model.providerUsage[0]).toMatchObject({
      provider: 'opencode-go',
      secondaryLabel: 'workspace-a',
    });
    expect(model.clientKeys[0]).toMatchObject({ label: 'client-a', totalTokens: 0 });
    expect(model.heatmap[0]).toMatchObject({ day: 2, hour: 9, totalTokens: 0 });
    expect(model.comparison).toMatchObject({
      state: 'ok',
      deltaCalls: 5,
      deltaTokens: 32,
      deltaCost: -1,
    });
  });

  test('aligns OpenCode credential identity with monitoring safe identity', () => {
    const model = buildUsageAnalyticsModel({ analytics: successResult });
    const usageIdentity = model.credentials[0].safeIdentity;
    const monitoringIdentity = deriveMonitoringSourceIdentity(
      {
        eventHash: 'event-1',
        timestampMs: 1,
        provider: 'opencode-go',
        model: 'claude-sonnet-4',
        endpoint: '/v1/messages',
        authIndex: 'entry-a',
        sourceHash: '',
        totalTokens: 42,
        failed: false,
      },
      null,
      {
        provider: 'opencode-go',
        entry: 'entry-a',
        workspace: 'workspace-a',
        protocol: 'codex',
        account: 'unsafe-account-secret',
        'api-key': 'unsafe-api-key-secret',
        cookie: 'unsafe-cookie-secret',
      }
    );

    expect(usageIdentity?.identityKey).toBe(monitoringIdentity.identityKey);
    expect(usageIdentity?.safeQuery).toEqual(monitoringIdentity.safeQuery);
    expect(JSON.stringify(model.credentials[0])).not.toContain('unsafe-account-secret');
    expect(JSON.stringify(model.credentials[0])).not.toContain('unsafe-api-key-secret');
    expect(JSON.stringify(model.credentials[0])).not.toContain('unsafe-cookie-secret');
  });

  test('does not collapse loading, empty, unsupported, error, and unavailable states', () => {
    expect(buildUsageAnalyticsModel().state).toBe('idle');
    expect(buildUsageAnalyticsModel({ loading: true }).state).toBe('loading');
    expect(
      buildUsageAnalyticsModel({
        analytics: {
          kind: 'empty',
          data: analyticsFixture,
          status: {
            state: 'empty',
            hasData: false,
            partial: false,
            stale: false,
            errors: [],
            warnings: [],
          },
        },
      }).state
    ).toBe('empty');
    expect(
      buildUsageAnalyticsModel({ analytics: { kind: 'unsupported', message: 'unsupported' } }).state
    ).toBe('unsupported');
    expect(
      buildUsageAnalyticsModel({ analytics: { kind: 'error', message: 'failed' } }).state
    ).toBe('error');
    expect(formatUsageAnalyticsState('unavailable')).toBe('Unavailable');
  });
});
