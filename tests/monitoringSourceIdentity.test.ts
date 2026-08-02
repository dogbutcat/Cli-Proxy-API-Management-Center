import { describe, expect, test } from 'bun:test';
import { deriveOpenCodeGoAuthFileIdentity } from '../src/features/authFiles/identity';
import {
  buildMonitoringSafeLogsPath,
  deriveMonitoringSourceIdentity,
} from '../src/features/monitoring/model/sourceDisplay';
import { buildLogsSearchQueryFromParams } from '../src/services/api/logs';
import { normalizeOpenCodeGoSourceIdentity } from '../src/services/api/opencodeGo';
import type { AuthFileItem } from '../src/types';

describe('OpenCode Go monitoring source identity', () => {
  test('auth files and monitoring records share the same workspace identity key', () => {
    const authFile = {
      name: 'opencode-go-runtime',
      provider: 'opencode-go',
      authIndex: 'entry-from-auth-file',
      workspace: 'workspace-a',
      protocol: 'codex',
      runtimeOnly: true,
    } as AuthFileItem;
    const monitoringSource = normalizeOpenCodeGoSourceIdentity({
      provider: 'opencode-go',
      entry: 'entry-from-monitoring',
      workspace: 'workspace-a',
      protocol: 'codex',
    });

    expect(deriveOpenCodeGoAuthFileIdentity(authFile).identityKey).toBe(
      monitoringSource.identityKey
    );
    expect(monitoringSource.identityKey).toBe('workspace:workspace-a');
  });

  test('protocol and alias normalize consistently for log source records', () => {
    const source = normalizeOpenCodeGoSourceIdentity({
      aliases: [{ alias: 'Team Codex' }],
      provider: 'opencode-go',
      entry: 'entry-a',
      protocol_type: 'responses',
    });

    expect(source.label).toBe('Team Codex');
    expect(source.protocol).toBe('responses');
    expect(source.identityKey).toBe('entry:entry-a');
    expect(source.status).toBe('legacy');
  });

  test('account, api-key, and cookie are redacted from source identity output', () => {
    const source = normalizeOpenCodeGoSourceIdentity({
      provider: 'opencode-go',
      workspace: 'workspace-a',
      account: 'raw-account-secret',
      'api-key': 'raw-api-key-secret',
      cookie: 'raw-cookie-secret',
    });

    const serialized = JSON.stringify(source);
    expect(serialized).not.toContain('raw-account-secret');
    expect(serialized).not.toContain('raw-api-key-secret');
    expect(serialized).not.toContain('raw-cookie-secret');
    expect(source.label).toBe('opencode-go');
    expect(source.identityKey).toBe('workspace:workspace-a');
    expect(source.ignoredUnsafeFields).toEqual(['account', 'api-key', 'cookie']);
  });

  test('monitoring log links carry safe searchable identity without secrets', () => {
    const source = deriveMonitoringSourceIdentity(
      {
        eventHash: 'event-a',
        timestampMs: 1785626400000,
        provider: 'opencode-go',
        authProviderSnapshot: 'opencode-go',
        model: 'gpt-5-codex',
        endpoint: '/v1/chat/completions',
        authIndex: 'auth-a',
        sourceHash: 'source-hash-a',
        accountSnapshot: 'raw-account-secret',
        authLabelSnapshot: 'Team Alias',
        totalTokens: 100,
        failed: false,
      },
      null,
      {
        provider: 'opencode-go',
        workspace: 'workspace-a',
        protocol: 'codex',
        account: 'raw-account-secret',
        'api-key': 'raw-api-key-secret',
        cookie: 'raw-cookie-secret',
      }
    );

    const path = buildMonitoringSafeLogsPath({
      ...source.safeQuery,
      account: 'raw-account-secret',
      cookie: 'raw-cookie-secret',
    });
    const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));

    expect(path).toContain('/logs?');
    expect(path).toContain('provider=opencode-go');
    expect(path).toContain('source_hash=source-hash-a');
    expect(path).toContain('identity_key=workspace%3Aworkspace-a');
    expect(buildLogsSearchQueryFromParams(params)).toContain('workspace:workspace-a');
    expect(path).not.toContain('account');
    expect(path).not.toContain('cookie');
    expect(path).not.toContain('raw-account-secret');
    expect(path).not.toContain('raw-api-key-secret');
    expect(path).not.toContain('raw-cookie-secret');
  });
});
