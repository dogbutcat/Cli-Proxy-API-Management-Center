import { describe, expect, test } from 'bun:test';
import {
  buildMonitoringAnalyticsRequest,
  buildMonitoringSelectorsRequest,
  mergeMonitoringRealtimePage,
  readNextMonitoringCursor,
  refilterMonitoringAnalytics,
} from '../src/features/monitoring/model/monitoringCenterPageModel';
import { deriveMonitoringSourceIdentity } from '../src/features/monitoring/model/sourceDisplay';
import { createDefaultMonitoringCenterUiState } from '../src/features/monitoring/monitoringCenterUiState';
import type { MonitoringAnalyticsResponse } from '../src/services/api/usageService';

describe('monitoring feature contracts', () => {
  test('compact and full analytics requests only change include shape', () => {
    const base = {
      ...createDefaultMonitoringCenterUiState(1_775_000_000_000),
      fromMs: 1_774_900_000_000,
      toMs: 1_775_000_000_000,
      filters: {
        providers: ['opencode-go'],
        authIndices: ['auth-opencode'],
        apiKeyHashes: ['key-hash'],
        includeFailed: false,
        searchQuery: 'sonnet',
      },
      cursor: {
        beforeMs: 1_775_000_000_000,
        beforeId: 42,
      },
    };

    const compact = buildMonitoringAnalyticsRequest({ ...base, density: 'compact' });
    const full = buildMonitoringAnalyticsRequest({ ...base, density: 'full' });

    expect(full.filters).toEqual(compact.filters);
    expect(full.searchQuery).toBe(compact.searchQuery);
    expect(full.include?.summaryProfile).toBe('full');
    expect(compact.include?.summaryProfile).toBe('compact');
    expect(full.include?.eventsPage).toEqual(compact.include?.eventsPage);
  });

  test('selector envelope is separated from the main request with shared filter semantics', () => {
    const state = {
      ...createDefaultMonitoringCenterUiState(1_775_000_000_000),
      filters: {
        models: ['claude-sonnet-4'],
        providers: ['opencode-go'],
        authIndices: ['auth-opencode'],
        headerTraceIds: ['trace-1'],
        includeFailed: true,
      },
    };

    const main = buildMonitoringAnalyticsRequest(state);
    const selectors = buildMonitoringSelectorsRequest(state);

    expect(selectors.filters).toEqual(main.filters);
    expect(selectors.include?.filterSelectors).toBe(true);
    expect(selectors.include?.filterOptions).toBe(true);
    expect(selectors.include?.eventsPage).toBeUndefined();
    expect(main.include?.eventsPage).toEqual({
      limit: 200,
      beforeMs: null,
      beforeId: null,
    });
  });

  test('realtime pagination uses backend nextBefore cursor and de-dupes by event hash', () => {
    const current: MonitoringAnalyticsResponse = {
      generatedAtMs: 1,
      granularity: 'hour',
      events: {
        items: [
          {
            id: 9,
            eventHash: 'event-9',
            timestampMs: 90,
            provider: 'opencode-go',
            model: 'a',
            endpoint: '/v1/messages',
            authIndex: 'auth-a',
            sourceHash: 'source-a',
            totalTokens: 1,
            failed: false,
          },
        ],
        nextCursor: 'cursor-9',
        nextBeforeMs: 90,
        nextBeforeId: 9,
        hasMore: true,
      },
    };
    const next: MonitoringAnalyticsResponse = {
      generatedAtMs: 2,
      granularity: 'hour',
      events: {
        items: [
          {
            id: 9,
            eventHash: 'event-9',
            timestampMs: 90,
            provider: 'opencode-go',
            model: 'a',
            endpoint: '/v1/messages',
            authIndex: 'auth-a',
            sourceHash: 'source-a',
            totalTokens: 1,
            failed: false,
          },
          {
            id: 8,
            eventHash: 'event-8',
            timestampMs: 80,
            provider: 'opencode-go',
            model: 'b',
            endpoint: '/v1/responses',
            authIndex: 'auth-b',
            sourceHash: 'source-b',
            totalTokens: 2,
            failed: false,
          },
        ],
        nextCursor: 'cursor-8',
        nextBeforeMs: 80,
        nextBeforeId: 8,
        hasMore: true,
      },
    };

    const merged = mergeMonitoringRealtimePage(current, next);

    expect(merged.events?.items.map((item) => item.eventHash)).toEqual(['event-9', 'event-8']);
    expect(readNextMonitoringCursor(merged)).toEqual({
      beforeMs: 80,
      beforeId: 8,
    });
  });

  test('local event re-filter remains after server response', () => {
    const state = {
      ...createDefaultMonitoringCenterUiState(1_775_000_000_000),
      filters: {
        providers: ['opencode-go'],
        authIndices: ['auth-keep'],
        includeFailed: false,
        searchQuery: 'sonnet',
      },
    };
    const analytics: MonitoringAnalyticsResponse = {
      generatedAtMs: 1,
      granularity: 'hour',
      events: {
        items: [
          {
            eventHash: 'keep',
            timestampMs: 1,
            provider: 'opencode-go',
            model: 'claude-sonnet-4',
            endpoint: '/v1/messages',
            authIndex: 'auth-keep',
            sourceHash: 'source-a',
            totalTokens: 1,
            failed: false,
          },
          {
            eventHash: 'drop-provider',
            timestampMs: 2,
            provider: 'other',
            model: 'claude-sonnet-4',
            endpoint: '/v1/messages',
            authIndex: 'auth-keep',
            sourceHash: 'source-b',
            totalTokens: 1,
            failed: false,
          },
          {
            eventHash: 'drop-failed',
            timestampMs: 3,
            provider: 'opencode-go',
            model: 'claude-sonnet-4',
            endpoint: '/v1/messages',
            authIndex: 'auth-keep',
            sourceHash: 'source-c',
            totalTokens: 1,
            failed: true,
          },
        ],
        nextCursor: null,
        nextBeforeMs: null,
        nextBeforeId: null,
        hasMore: false,
      },
    };

    const filtered = refilterMonitoringAnalytics(analytics, state);

    expect(filtered.events?.items.map((item) => item.eventHash)).toEqual(['keep']);
  });

  test('OpenCode monitoring source identity exposes only safe query fields', () => {
    const identity = deriveMonitoringSourceIdentity(
      {
        eventHash: 'event-1',
        timestampMs: 1,
        provider: 'opencode-go',
        model: 'claude-sonnet-4',
        endpoint: '/v1/messages',
        authIndex: 'entry-a',
        sourceHash: 'source-a',
        totalTokens: 1,
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

    const serialized = JSON.stringify(identity);
    expect(identity.identityKey).toBe('workspace:workspace-a');
    expect(identity.safeQuery).toEqual({
      provider: 'opencode-go',
      auth_index: 'entry-a',
      source_hash: 'source-a',
      identity_key: 'workspace:workspace-a',
      workspace: 'workspace-a',
      entry: 'entry-a',
      protocol: 'codex',
    });
    expect(serialized).not.toContain('unsafe-account-secret');
    expect(serialized).not.toContain('unsafe-api-key-secret');
    expect(serialized).not.toContain('unsafe-cookie-secret');
  });
});
