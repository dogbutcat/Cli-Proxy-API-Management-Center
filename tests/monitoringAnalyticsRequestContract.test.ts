import { describe, expect, test } from 'bun:test';
import {
  buildCompactMonitoringAnalyticsInclude,
  normalizeMonitoringAnalyticsResponse,
  normalizeUsageApiResult,
  normalizeUsageCapabilities,
  serializeDashboardSummaryParams,
  serializeMonitoringAnalyticsRequest,
  serializeMonitoringListParams,
} from '../src/services/api/usageService';

describe('monitoring analytics request contract', () => {
  test('serializes compact analytics include with keyset cursor fields', () => {
    const include = buildCompactMonitoringAnalyticsInclude(
      {
        limit: 500,
        beforeMs: 1_775_000_000_000,
        beforeId: 128,
      },
      'hour'
    );

    expect(
      serializeMonitoringAnalyticsRequest({
        fromMs: 1_774_900_000_000,
        toMs: 1_775_000_000_000,
        searchQuery: 'sonnet',
        filters: {
          authIndices: ['auth-opencode'],
          apiKeyHashes: ['abcdef'],
          headerTraceIds: ['trace-1'],
          includeFailed: false,
        },
        include,
      })
    ).toEqual({
      from_ms: 1_774_900_000_000,
      to_ms: 1_775_000_000_000,
      search_query: 'sonnet',
      filters: {
        auth_indices: ['auth-opencode'],
        api_key_hashes: ['abcdef'],
        header_trace_ids: ['trace-1'],
        include_failed: false,
      },
      include: {
        summary: true,
        summary_profile: 'compact',
        account_stats: true,
        api_key_stats: true,
        events_page: {
          limit: 500,
          before_ms: 1_775_000_000_000,
          before_id: 128,
        },
        granularity: 'hour',
      },
    });
  });

  test('serializes full monitoring query aliases only at the service boundary', () => {
    expect(
      serializeMonitoringListParams({
        fromMs: 1,
        toMs: 2,
        requestType: '/v1/messages',
        cacheStatus: 'hit',
        failed: 'all',
        cursor: 'cursor-token',
        include: ['full', 'events'],
      })
    ).toEqual({
      from_ms: 1,
      to_ms: 2,
      request_type: '/v1/messages',
      cache_status: 'hit',
      failed: 'all',
      cursor: 'cursor-token',
      include: 'full,events',
    });
  });

  test('normalizes event page cursor and legacy events/items aliases', () => {
    const response = normalizeMonitoringAnalyticsResponse({
      generated_at_ms: 1,
      granularity: 'hour',
      summary: {
        total_calls: 1,
        success_calls: 1,
        total_tokens: 42,
      },
      events: {
        events: [
          {
            id: 7,
            event_hash: 'hash-1',
            timestamp_ms: 1_775_000_000_000,
            model: 'claude-sonnet-4',
            endpoint: '/v1/messages',
            auth_index: 'auth-opencode',
            source_hash: 'source-a',
            total_tokens: 42,
            failed: false,
            header_trace_id: 'trace-1',
          },
        ],
        next_cursor: 'encoded-cursor',
        next_before_ms: 1_775_000_000_000,
        next_before_id: 7,
        has_more: true,
      },
    });

    expect(response.events).toEqual({
      items: [
        {
          id: 7,
          requestId: undefined,
          eventHash: 'hash-1',
          timestampMs: 1_775_000_000_000,
          provider: undefined,
          model: 'claude-sonnet-4',
          resolvedModel: undefined,
          endpoint: '/v1/messages',
          method: undefined,
          path: undefined,
          authIndex: 'auth-opencode',
          source: undefined,
          sourceHash: 'source-a',
          apiKeyHash: undefined,
          accountSnapshot: undefined,
          authLabelSnapshot: undefined,
          authFileSnapshot: undefined,
          authProviderSnapshot: undefined,
          authProjectIdSnapshot: undefined,
          totalTokens: 42,
          failed: false,
          failStatusCode: null,
          failSummary: undefined,
          latencyMs: null,
          headerTraceId: 'trace-1',
        },
      ],
      nextCursor: 'encoded-cursor',
      nextBeforeMs: 1_775_000_000_000,
      nextBeforeId: 7,
      hasMore: true,
      totalCount: undefined,
    });
  });

  test('keeps success, empty, unsupported, and error states distinguishable', () => {
    const empty = normalizeUsageApiResult(
      { status: { state: 'empty', has_data: false }, items: [] },
      (payload) => payload
    );
    const unsupported = normalizeUsageApiResult(
      {
        unsupported: true,
        error: 'account actions are unsupported',
        code: 'account_actions_unsupported',
        status: { state: 'unsupported' },
      },
      (payload) => payload
    );
    const error = normalizeUsageApiResult({ error: 'query failed' }, (payload) => payload);
    const success = normalizeUsageApiResult(
      { status: { state: 'ok', has_data: true } },
      (payload) => payload
    );

    expect(empty.kind).toBe('empty');
    expect(unsupported.kind).toBe('unsupported');
    expect(error.kind).toBe('error');
    expect(success.kind).toBe('success');
  });

  test('normalizes capability snapshot and dashboard query fields', () => {
    expect(
      normalizeUsageCapabilities({
        source: 'integrated',
        schema_version: 1,
        account_actions: {
          supported: false,
          reason: 'unsupported_local_sqlite',
          version: 'unsupported-v1',
        },
      })
    ).toEqual({
      source: 'integrated',
      schemaVersion: 1,
      accountActions: {
        supported: false,
        reason: 'unsupported_local_sqlite',
        version: 'unsupported-v1',
        state: 'unsupported',
      },
    });
    expect(
      serializeDashboardSummaryParams({
        todayStartMs: 1,
        nowMs: 2,
        topModels: 3,
        recentFailures: 4,
      })
    ).toEqual({
      today_start_ms: 1,
      now_ms: 2,
      top_models: 3,
      recent_failures: 4,
    });
  });
});
