import { describe, expect, test } from 'bun:test';
import { deriveMonitoringSourceIdentity } from '../src/features/monitoring/model/sourceDisplay';
import {
  adaptUsageAnalyticsData,
  buildUsageAnalyticsFilters,
  buildUsageAnalyticsInclude,
  buildUsageSummary,
  maskApiKeyHash,
  resolveUsageApiKeyLabel,
  type UsageAnalyticsFiltersState,
} from '../src/features/usage-analytics/usageAnalyticsModel';
import { buildUsageHeatmapSummaryCards } from '../src/features/usage-analytics/usageAnalyticsPresentation';
import type { MonitoringAnalyticsResponse } from '../src/services/api/usageService';

const filters: UsageAnalyticsFiltersState = {
  timeRange: '7d',
  customRange: null,
  granularity: 'day',
  model: 'qwen3.7-max',
  apiKeyHash: 'ABCDEF123456',
  provider: 'opencode-go',
  authFile: 'entry-a',
  status: 'failed',
  searchQuery: 'workspace-a',
  minLatencyMs: '10000',
  cacheStatus: 'miss',
  apiKeyKeyword: '',
};

const analyticsFixture: MonitoringAnalyticsResponse = {
  generatedAtMs: 1_775_000_000_000,
  generated_at_ms: 1_775_000_000_000,
  granularity: 'hour',
  summary: {
    total_calls: 7,
    success_calls: 5,
    failure_calls: 2,
    success_rate: 71.4,
    input_tokens: 20,
    output_tokens: 22,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: 42,
    total_cost: 0,
    average_latency_ms: null,
    zero_token_calls: 1,
    rpm_30m: 0,
    tpm_30m: 0,
    avg_daily_requests: 1,
    avg_daily_tokens: 6,
    approx_tasks: 1,
    approx_task_failures: 0,
    approx_task_success_rate: 100,
    zero_token_models: ['zero-token-model'],
  },
  model_stats: [
    {
      model: 'qwen3.7-max',
      calls: 3,
      tokens: 42,
      cost: 0,
      success_calls: 2,
      failure_calls: 1,
      success_rate: 66.7,
      input_tokens: 20,
      output_tokens: 22,
      cached_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      total_tokens: 42,
    },
  ],
  api_key_stats: [
    {
      id: 'abcdef123456',
      api_key_hash: 'abcdef123456',
      account_snapshot: 'client-a',
      auth_provider_snapshot: 'opencode-go',
      auth_indices: ['entry-a'],
      sources: ['workspace-a'],
      source_hashes: ['source-a'],
      calls: 4,
      success_calls: 3,
      failure_calls: 1,
      success_rate: 75,
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      total_tokens: 0,
      cost: 0,
      average_latency_ms: 1200,
      last_seen_ms: 1_775_000_000_000,
    },
  ],
  credential_stats: [
    {
      id: 'entry-a',
      auth_index: 'entry-a',
      auth_provider_snapshot: 'opencode-go',
      account_snapshot: 'workspace-a',
      source_hash: 'source-a',
      calls: 3,
      success_calls: 2,
      failure_calls: 1,
      success_rate: 66.7,
      input_tokens: 20,
      output_tokens: 22,
      cached_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      total_tokens: 42,
      cost: 0,
      average_latency_ms: 1300,
      last_seen_ms: 1_775_000_000_000,
    },
  ],
  channel_share: [
    {
      auth_index: 'entry-a',
      source_hash: 'source-a',
      account_snapshot: 'workspace-a',
      auth_provider_snapshot: 'opencode-go',
      calls: 3,
      success: 2,
      failure: 1,
      tokens: 42,
      cost: 0,
      average_latency_ms: 1300,
    },
  ],
};

describe('usage analytics contract', () => {
  const t = ((key: string) => key) as Parameters<typeof buildUsageHeatmapSummaryCards>[0]['t'];

  test('builds full aggregate include and canonical filters for the restored analytics page', () => {
    expect(buildUsageAnalyticsFilters(filters)).toEqual({
      models: ['qwen3.7-max'],
      providers: ['opencode-go'],
      auth_files: ['entry-a'],
      api_key_hashes: ['abcdef123456'],
      failed_only: true,
      min_latency_ms: 10000,
      cache_status: 'miss',
    });

    expect(buildUsageAnalyticsInclude('hour')).toMatchObject({
      summary: true,
      summary_comparison: true,
      timeline: true,
      model_stats: true,
      channel_share: true,
      filter_options: true,
      credential_stats: true,
      credential_timeline: true,
      api_key_stats: true,
      heatmap: true,
      anomaly_points: true,
      granularity: 'hour',
    });
  });

  test('uses API key aliases or masks hashes instead of exposing raw client key hashes', () => {
    const displayMap = new Map([
      ['abcdef123456', { label: 'Production key', masked: 'sk-****3456' }],
    ]);
    const adapted = adaptUsageAnalyticsData(analyticsFixture, 'hour', '', displayMap);

    expect(resolveUsageApiKeyLabel('abcdef123456', displayMap)).toBe('Production key');
    expect(maskApiKeyHash('abcdef123456')).toBe('sk-****3456');
    expect(adapted.apiKeyRows[0]).toMatchObject({
      apiKeyHash: 'abcdef123456',
      label: 'Production key',
      provider: 'opencode-go',
      totalTokens: 0,
    });
    expect(adapted.apiKeyRows[0].contexts).toEqual([
      expect.objectContaining({
        id: 'source-a',
        sourceHash: 'source-a',
        source: 'workspace-a',
        authIndex: 'entry-a',
        requestCount: 4,
      }),
    ]);
  });

  test('aligns OpenCode credential identity with monitoring safe identity', () => {
    const adapted = adaptUsageAnalyticsData(analyticsFixture, 'hour');
    const row = adapted.credentialRows[0];
    const monitoringIdentity = deriveMonitoringSourceIdentity(
      {
        eventHash: 'event-1',
        timestampMs: 1,
        provider: 'opencode-go',
        model: 'qwen3.7-max',
        endpoint: '/v1/chat/completions',
        authIndex: 'entry-a',
        sourceHash: 'source-a',
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

    expect(row.id).toBe('entry-a');
    expect(monitoringIdentity.identityKey).toBe('workspace:workspace-a');
    expect(JSON.stringify(row)).not.toContain('unsafe-account-secret');
    expect(JSON.stringify(row)).not.toContain('unsafe-api-key-secret');
    expect(JSON.stringify(row)).not.toContain('unsafe-cookie-secret');
  });

  test('keeps heatmap summary cache-hit card visible', () => {
    const summary = buildUsageSummary({
      ...analyticsFixture.summary,
      input_tokens: 100,
      cached_tokens: 0,
      cache_read_tokens: 25,
      cache_creation_tokens: 25,
      total_tokens: 150,
    });

    const cards = buildUsageHeatmapSummaryCards({ locale: 'en-US', summary, t });
    const cacheCard = cards.find((card) => card.icon === 'cache');

    expect(cards).toHaveLength(5);
    expect(cacheCard).toMatchObject({
      label: 'usage_analytics.cache_read_rate',
      meta: 'usage_analytics.metric_cached_tokens 50',
      value: '16.7%',
    });
  });
});
