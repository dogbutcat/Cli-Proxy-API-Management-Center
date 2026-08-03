import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { buildUsageDetailsFromAnalyticsEvents } from '../src/features/monitoring/model/analyticsAdapters';
import { buildEventRows } from '../src/features/monitoring/model/eventRows';
import { buildApiKeyOptionsFromRows } from '../src/features/monitoring/model/monitoringCenterPageModel';
import { buildMonitoringInitialStateFromQuery } from '../src/features/monitoring/model/monitoringCenterPageModel';
import { buildScopeFilteredRows } from '../src/features/monitoring/model/rowBuilders';
import { deriveMonitoringSourceIdentity } from '../src/features/monitoring/model/sourceDisplay';
import { normalizeMonitoringCenterUiState } from '../src/features/monitoring/monitoringCenterUiState';
import { buildSourceInfoMap } from '../src/utils/sourceResolver';

describe('monitoring feature contracts', () => {
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

  test('Monitoring API key selector masks selected hash-only query values', () => {
    const selectedHash =
      '3132548b902f2677082af1a9fbefa6031e44e2a3082787ee040a9e535b5a0475';
    const t = ((key: string) => key) as TFunction;
    const options = buildApiKeyOptionsFromRows([], selectedHash, t);
    const selected = options.find((option) => option.value === selectedHash);

    expect(selected).toEqual({
      value: selectedHash,
      label: 'sk-****0475',
    });
    expect(selected?.label).not.toBe(selectedHash);
  });

  test('Monitoring event rows keep source-hash client key fallback for API key filters', () => {
    const selectedHash =
      'b263156d558b460b7e18e810d7a86412571fa8d26013a884687a8b1cc4f620dd';
    const details = buildUsageDetailsFromAnalyticsEvents([
      {
        timestamp_ms: Date.UTC(2026, 7, 2, 14, 17, 1),
        timestamp: '2026-08-02T14:17:01.000Z',
        request_id: 'request-a',
        event_hash: 'event-a',
        provider: 'claude',
        model: 'qwen3.7-max',
        endpoint: 'POST /v1/messages',
        method: 'POST',
        path: '/v1/messages',
        auth_index: 'auth-a',
        source: 'm:sk-0...6TRJ',
        source_hash: selectedHash,
        api_key_hash: '',
        account_snapshot: 'hiroshi@yoshima.xyz',
        auth_label_snapshot: 'hiroshi@yoshima.xyz',
        auth_provider_snapshot: 'claude',
        input_tokens: 1200,
        output_tokens: 997,
        reasoning_tokens: 537,
        cached_tokens: 0,
        total_tokens: 2734,
        failed: false,
      },
    ]);
    const rows = buildEventRows(
      details,
      new Map(),
      new Map(),
      buildSourceInfoMap({}),
      new Map(),
      {},
      new Map()
    );
    const filteredRows = buildScopeFilteredRows(rows, { apiKeyHash: selectedHash });

    expect(details[0].api_key_hash).toBe(selectedHash);
    expect(rows[0].apiKeyHash).toBe(selectedHash);
    expect(filteredRows).toHaveLength(1);
  });

  test('Monitoring API key drilldowns do not persist as default filters', () => {
    const selectedHash =
      '3132548b902f2677082af1a9fbefa6031e44e2a3082787ee040a9e535b5a0475';
    const storedState = normalizeMonitoringCenterUiState({
      selectedApiKeyHash: selectedHash,
      selectedHeaderTraceId: 'trace-a',
      selectedModel: 'qwen3.7-max',
    });

    expect(storedState.selectedApiKeyHash).toBe('all');
    expect(storedState.selectedHeaderTraceId).toBe('all');
    expect(storedState.selectedModel).toBe('qwen3.7-max');

    const queryState = buildMonitoringInitialStateFromQuery(
      `?api_key_hash=${selectedHash}&header_trace_id=trace-a`,
      storedState
    );
    expect(queryState.selectedApiKeyHash).toBe(selectedHash);
    expect(queryState.selectedHeaderTraceId).toBe('trace-a');
    expect(queryState.activeDataTab).toBe('realtime');
  });
});
