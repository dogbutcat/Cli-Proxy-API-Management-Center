import { describe, expect, test } from 'bun:test';
import {
  normalizeOpenCodeGoIdentity,
  normalizeOpenCodeGoSourceIdentity,
} from '../src/services/api/opencodeGo';

describe('OpenCode Go identity normalization', () => {
  test('uses workspace as the stable identity key before entry', () => {
    const identity = normalizeOpenCodeGoIdentity({
      provider: 'opencode-go',
      entry: 'oauth-entry-a',
      workspace: ' Team Workspace ',
      protocol: 'codex',
    });

    expect(identity.identityKey).toBe('workspace:team workspace');
    expect(identity.keySource).toBe('workspace');
    expect(identity.status).toBe('canonical');
  });

  test('falls back to entry as a legacy key when workspace and project are absent', () => {
    const identity = normalizeOpenCodeGoIdentity({
      provider: 'opencode-go',
      entry: 'oauth-entry-a',
      protocol: 'codex',
    });

    expect(identity.identityKey).toBe('entry:oauth-entry-a');
    expect(identity.status).toBe('legacy');
  });

  test('normalizes the label chain without using unsafe credential fields', () => {
    const identity = normalizeOpenCodeGoIdentity({
      aliases: [' Codex Team '],
      provider: 'opencode-go',
      entry: 'entry-a',
      workspace: 'team-a',
      account: 'sk-live-secret',
      apiKey: 'sk-api-secret',
      cookie: 'session=secret',
      headers: { Authorization: 'Bearer secret' },
    });

    expect(identity.label).toBe('Codex Team');
    expect(identity.identityKey).toBe('workspace:team-a');
    expect(JSON.stringify(identity)).not.toContain('sk-live-secret');
    expect(JSON.stringify(identity)).not.toContain('sk-api-secret');
    expect(JSON.stringify(identity)).not.toContain('session=secret');
    expect(JSON.stringify(identity)).not.toContain('Bearer secret');
    expect(identity.ignoredUnsafeFields).toEqual([
      'account',
      'apiKey',
      'cookie',
      'headers.Authorization',
    ]);
  });

  test('reports configured-pending, runtime-only, and empty diagnostics', () => {
    expect(normalizeOpenCodeGoIdentity({ configured: true, provider: 'opencode-go' }).status).toBe(
      'configured-pending'
    );
    expect(normalizeOpenCodeGoIdentity({ runtimeOnly: 'true', entry: 'runtime-a' }).status).toBe(
      'runtime-only'
    );
    expect(normalizeOpenCodeGoIdentity({ account: 'sk-secret' }).status).toBe('empty');
  });

  test('shares the same normalizer for monitoring and log source records', () => {
    const identity = normalizeOpenCodeGoSourceIdentity({
      alias: { name: 'monitor alias' },
      provider: 'opencode-go',
      workspace_id: 'workspace-a',
      protocol_type: 'responses',
    });

    expect(identity.label).toBe('monitor alias');
    expect(identity.protocol).toBe('responses');
    expect(identity.identityKey).toBe('workspace:workspace-a');
  });
});
