import { describe, expect, test } from 'bun:test';
import {
  buildLogRecordSearchText,
  buildLogsSearchQueryFromParams,
  buildSafeLogsPath,
  normalizeLogsResponse,
  readLogsStructuredFiltersFromParams,
} from '../src/services/api/logs';
import { parseLogLine } from '../src/pages/hooks/logParsing';

describe('Logs OpenCode discoverability', () => {
  test('normalizes upstream entry aliases into searchable safe text', () => {
    const response = normalizeLogsResponse({
      entries: [
        {
          timestamp: '2026-08-02 10:00:00',
          level: 'info',
          source: 'gin_logger.go:94',
          method: 'POST',
          path: '/v1/chat/completions',
          status_code: 200,
          message: 'request completed',
          provider: 'opencode-go',
          model: 'gpt-5.3-codex-spark',
          auth_index: 'auth-team-a',
          source_hash: 'source-hash-a',
          source_identity: {
            workspace: 'workspace-a',
            protocol: 'codex',
            account: 'raw-account-secret',
            'api-key': 'raw-api-key-secret',
            cookie: 'raw-cookie-secret',
          },
        },
      ],
      latestTimestamp: '2026-08-02T10:00:00Z',
      nextCursor: 'cursor-a',
      cursorReset: 'true',
    });

    expect(response.nextCursor).toBe('cursor-a');
    expect(response.cursorReset).toBe(true);
    expect(response.latestAfter).toBeGreaterThan(0);
    expect(response.lines).toHaveLength(1);

    const line = response.lines[0];
    expect(line).toContain('opencode-go');
    expect(line).toContain('gpt-5.3-codex-spark');
    expect(line).toContain('auth-team-a');
    expect(line).toContain('source-hash-a');
    expect(line).toContain('workspace:workspace-a');
    expect(line).not.toContain('raw-account-secret');
    expect(line).not.toContain('raw-api-key-secret');
    expect(line).not.toContain('raw-cookie-secret');

    const parsed = parseLogLine(line);
    expect(parsed.source).toBe('gin_logger.go:94');
    expect(parsed.method).toBe('POST');
    expect(parsed.path).toBe('/v1/chat/completions');
    expect(parsed.statusCode).toBe(200);
  });

  test('keeps legacy line payload fields working', () => {
    const response = normalizeLogsResponse({
      lines: ['2026-08-02 10:00:00 info [server.go:10] GET /health 200'],
      'latest-timestamp': 1785626400,
      'next-cursor': 'legacy-cursor',
      'cursor-reset': false,
    });

    expect(response).toEqual({
      lines: ['2026-08-02 10:00:00 info [server.go:10] GET /health 200'],
      latestAfter: 1785626400,
      nextCursor: 'legacy-cursor',
      cursorReset: false,
    });
  });

  test('builds search text only from safe OpenCode identity fields', () => {
    const text = buildLogRecordSearchText({
      provider: 'opencode-go',
      model: 'claude-sonnet-4-5',
      auth_index: 'auth-a',
      source_hash: 'source-a',
      source_identity: {
        alias: 'Team Alias',
        workspace: 'workspace-a',
        protocol_type: 'responses',
        account: 'raw-account-secret',
        apiKey: 'raw-api-key-secret',
        headers: { Authorization: 'Bearer raw-token-secret' },
      },
      cookie: 'raw-cookie-secret',
    });

    expect(text).toContain('opencode-go');
    expect(text).toContain('claude-sonnet-4-5');
    expect(text).toContain('auth-a');
    expect(text).toContain('source-a');
    expect(text).toContain('workspace:workspace-a');
    expect(text).toContain('Team Alias');
    expect(text).not.toContain('raw-account-secret');
    expect(text).not.toContain('raw-api-key-secret');
    expect(text).not.toContain('raw-cookie-secret');
    expect(text).not.toContain('raw-token-secret');
  });

  test('parses safe logs query links without turning source into provider or model filters', () => {
    const params = new URLSearchParams({
      provider: 'opencode-go',
      model: 'gpt-5-codex',
      auth_index: 'auth-a',
      source_hash: 'source-a',
      identity_key: 'workspace:workspace-a',
      source: 'gin_logger.go:94',
      method: 'post',
      status: '200',
      path: '/v1/chat/completions',
      account: 'raw-account-secret',
      cookie: 'raw-cookie-secret',
    });

    expect(buildLogsSearchQueryFromParams(params)).toBe(
      'opencode-go gpt-5-codex auth-a source-a workspace:workspace-a'
    );
    expect(readLogsStructuredFiltersFromParams(params)).toEqual({
      methods: ['POST'],
      statuses: ['2xx'],
      paths: ['/v1/chat/completions'],
      sources: ['gin_logger.go:94'],
    });
  });

  test('safe logs paths omit unsafe keys and secret-shaped values', () => {
    const path = buildSafeLogsPath({
      provider: 'opencode-go',
      model: 'gpt-5-codex',
      auth_index: 'auth-a',
      source_hash: 'source-a',
      source: 'gin_logger.go:94',
      account: 'raw-account-secret',
      'api-key': 'raw-api-key-secret',
      cookie: 'raw-cookie-secret',
      q: 'Bearer raw-token-secret',
    });

    expect(path).toContain('/logs?');
    expect(path).toContain('provider=opencode-go');
    expect(path).toContain('model=gpt-5-codex');
    expect(path).toContain('source=gin_logger.go%3A94');
    expect(path).not.toContain('account');
    expect(path).not.toContain('api-key');
    expect(path).not.toContain('cookie');
    expect(path).not.toContain('Bearer');
    expect(path).not.toContain('raw-token-secret');
  });
});
