import { describe, expect, test } from 'bun:test';
import { normalizeOpenCodeGoQuotaGroups } from '../src/services/api/opencodeGo';

describe('OpenCode Go quota group identity', () => {
  test('deduplicates virtual entries that point at the same workspace', () => {
    const groups = normalizeOpenCodeGoQuotaGroups([
      {
        provider: 'opencode-go',
        entry: 'runtime-entry',
        workspace: 'shared-workspace',
        runtimeOnly: true,
      },
      {
        provider: 'opencode-go',
        entry: 'configured-entry',
        workspace: ' shared-workspace ',
        configured: true,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.identity.identityKey).toBe('workspace:shared-workspace');
    expect(groups[1]?.identity.identityKey).toBe('workspace:shared-workspace');
    expect(groups.map((group) => group.identity.status)).toEqual([
      'runtime-only',
      'configured-pending',
    ]);
  });

  test('prefers nested sourceIdentity over outer account-only payloads', () => {
    const [group] = normalizeOpenCodeGoQuotaGroups({
      groups: [
        {
          account: 'sk-live-secret',
          label: 'outer unsafe label fallback',
          source_identity: {
            provider: 'opencode-go',
            entry: 'nested-entry',
            project_id: 'project-a',
            protocol: 'responses',
          },
        },
      ],
    });

    expect(group?.identity.identityKey).toBe('project:project-a');
    expect(group?.identity.label).toBe('opencode-go');
    expect(group?.identity.protocol).toBe('responses');
    expect(JSON.stringify(group?.identity)).not.toContain('sk-live-secret');
  });

  test('keeps empty quota records explicit instead of inventing identities', () => {
    const [group] = normalizeOpenCodeGoQuotaGroups([{ account: 'sk-live-secret' }]);

    expect(group?.id).toBe('empty:0');
    expect(group?.label).toBe('');
    expect(group?.identity.identityKey).toBe('');
    expect(group?.identity.status).toBe('empty');
  });
});
