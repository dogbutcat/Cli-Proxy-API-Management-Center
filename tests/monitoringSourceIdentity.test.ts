import { describe, expect, test } from 'bun:test';
import { deriveOpenCodeGoAuthFileIdentity } from '../src/features/authFiles/identity';
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
});
