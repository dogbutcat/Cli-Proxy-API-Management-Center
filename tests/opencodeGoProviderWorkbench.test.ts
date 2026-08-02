import { afterEach, describe, expect, test } from 'bun:test';
import { opencodeGoToResource } from '../src/features/providers/adapters';
import { PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeConfigResponse } from '../src/services/api/transformers';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

describe('OpenCode Go provider workbench', () => {
  test('normalizes canonical key-groups into a provider resource without secret labels', () => {
    const config = normalizeConfigResponse({
      'opencode-go': {
        'key-groups': [
          {
            'name-prefix': 'team',
            disabled: true,
            openai: {
              'name-suffix': 'openai',
              'base-url': 'https://openai.example/v1',
              prefix: 'og',
              priority: 7,
              models: [{ name: 'gpt-upstream', alias: 'gpt-visible' }],
            },
            anthropic: {
              'base-url': 'https://anthropic.example',
              models: ['claude-upstream'],
            },
            keys: [
              {
                'key-name': 'acct-a',
                'api-key': 'opencode-secret',
                'workspace-id': 'workspace-a',
                'auth-cookie': 'cookie-secret',
              },
            ],
          },
        ],
        quota: { 'poll-interval': '5m', threshold: 0.2 },
      },
    });

    expect(config.openCodeGo?.keyGroups).toHaveLength(1);
    const resource = opencodeGoToResource(config.openCodeGo!.keyGroups[0]!, 0);
    expect(resource.brand).toBe('opencodeGo');
    expect(resource.disabled).toBe(true);
    expect(resource.models).toEqual(['gpt-upstream', 'claude-upstream']);
    expect(resource.flags.protocols).toEqual(['openai', 'anthropic']);
    expect(resource.selector).toEqual({
      brand: 'opencodeGo',
      groupIndex: 0,
      identityKey: 'workspace:workspace-a',
    });
    expect(JSON.stringify(config.openCodeGo?.keyGroups[0]?.identity)).not.toContain(
      'cookie-secret'
    );
    expect(JSON.stringify(config.openCodeGo?.keyGroups[0]?.identity)).not.toContain(
      'opencode-secret'
    );
    expect(resource.identifier).not.toContain('opencode-secret');
    expect(PROVIDER_DESCRIPTORS.opencodeGo.sheetSize).toBe('lg');
  });

  test('persists key-groups through the canonical opencode-go section', async () => {
    const calls: Array<{ method: string; url: string; data?: unknown }> = [];
    apiClient.get = (async () => {
      calls.push({ method: 'GET', url: '/config' });
      return {};
    }) as typeof apiClient.get;
    apiClient.put = (async (url: string, data?: unknown) => {
      calls.push({ method: 'PUT', url, data });
      return undefined;
    }) as typeof apiClient.put;

    await providersApi.updateOpenCodeGoConfig({
      keyGroups: [
        {
          namePrefix: 'team',
          openai: {
            baseUrl: 'https://openai.example/v1',
            models: [{ name: 'gpt-upstream', alias: 'gpt-visible' }],
          },
          keys: [
            {
              keyName: 'acct-a',
              apiKey: 'opencode-secret',
              workspaceId: 'workspace-a',
            },
          ],
          identity: {
            provider: 'opencode-go',
            entry: 'acct-a',
            workspace: 'workspace-a',
            project: '',
            protocol: 'openai',
            alias: '',
            label: 'team',
            identityKey: 'workspace:workspace-a',
            status: 'canonical',
            diagnostic: 'canonical',
            diagnostics: [],
            keySource: 'workspace',
            labelSource: 'label',
            ignoredUnsafeFields: ['apiKey'],
          },
        },
      ],
      quota: { raw: { 'poll-interval': '5m' } },
      raw: { quota: { 'poll-interval': '5m' }, future: true },
    });

    expect(calls).toEqual([
      {
        method: 'PUT',
        url: '/opencode-go',
        data: {
          future: true,
          quota: { 'poll-interval': '5m' },
          'key-groups': [
            {
              'name-prefix': 'team',
              openai: {
                'base-url': 'https://openai.example/v1',
                models: [{ name: 'gpt-upstream', alias: 'gpt-visible' }],
              },
              keys: [
                {
                  'key-name': 'acct-a',
                  'api-key': 'opencode-secret',
                  'workspace-id': 'workspace-a',
                },
              ],
            },
          ],
        },
      },
    ]);
  });
});
