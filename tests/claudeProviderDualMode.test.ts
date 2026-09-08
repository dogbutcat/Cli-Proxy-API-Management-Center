import { describe, expect, test } from 'bun:test';
import { claudeMultikeyToResource } from '../src/features/providers/adapters';
import { serializeClaudeMultikeyEntry } from '../src/services/api/providers';
import { normalizeConfigResponse } from '../src/services/api/transformers';

describe('Claude provider dual-mode config', () => {
  test('normalizes traditional and multi-key Claude entries without mixing modes', () => {
    const config = normalizeConfigResponse({
      'claude-api-key': [
        {
          'api-key': 'traditional-key',
          'base-url': 'https://api.anthropic.com',
          weight: 7,
          'experimental-cch-signing': true,
        },
        {
          name: 'team-claude',
          'base-url': 'https://claude.example.com',
          prefix: 'claude/',
          priority: 3,
          disabled: false,
          'disable-cooling': true,
          'api-key-entries': [
            {
              'api-key': 'key-a',
              name: 'account-a',
              'proxy-url': 'http://127.0.0.1:7890',
              weight: 5,
              'auth-index': 'claude:account-a',
            },
          ],
          models: [
            {
              name: 'claude-sonnet-4',
              alias: 'sonnet',
              thinking: { levels: ['medium', 'high'] },
            },
          ],
          'experimental-cch-signing': true,
          'future-field': 'preserve',
        },
      ],
    });

    expect(config.claudeApiKeys).toEqual([
      {
        apiKey: 'traditional-key',
        baseUrl: 'https://api.anthropic.com',
        weight: 7,
      },
    ]);
    expect(config.claudeMultikeyEntries).toEqual([
      {
        _originalIndex: 1,
        name: 'team-claude',
        baseUrl: 'https://claude.example.com',
        prefix: 'claude/',
        priority: 3,
        disabled: false,
        disableCooling: true,
        apiKeyEntries: [
          {
            apiKey: 'key-a',
            name: 'account-a',
            proxyUrl: 'http://127.0.0.1:7890',
            weight: 5,
            authIndex: 'claude:account-a',
          },
        ],
        models: [
          {
            name: 'claude-sonnet-4',
            alias: 'sonnet',
            thinking: { levels: ['medium', 'high'] },
          },
        ],
      },
    ]);

    const resource = claudeMultikeyToResource(config.claudeMultikeyEntries![0], 0);
    expect(resource.brand).toBe('claude');
    expect(resource.name).toBe('team-claude');
    expect(resource.apiKeyEntryCount).toBe(1);
    expect(resource.selector).toEqual({
      brand: 'claude',
      apiKey: '',
      index: 1,
      mode: 'multikey',
    });
  });

  test('keeps named traditional Claude entries in traditional mode', () => {
    const config = normalizeConfigResponse({
      'claude-api-key': [
        {
          name: 'legacy-display-name',
          'api-key': 'traditional-key',
          'base-url': 'https://api.anthropic.com',
          weight: 9,
        },
      ],
    });

    expect(config.claudeMultikeyEntries).toBeUndefined();
    expect(config.claudeApiKeys).toEqual([
      {
        apiKey: 'traditional-key',
        baseUrl: 'https://api.anthropic.com',
        weight: 9,
      },
    ]);
  });

  test('serializes multi-key Claude entries while preserving unknown raw fields', () => {
    const payload = serializeClaudeMultikeyEntry(
      {
        name: 'team-claude',
        baseUrl: 'https://claude.example.com',
        apiKeyEntries: [
          {
            apiKey: 'key-a',
            name: 'account-a',
            proxyUrl: 'http://127.0.0.1:7890',
            weight: 5,
            authIndex: 'claude:account-a',
          },
        ],
        models: [{ name: 'claude-sonnet-4', thinking: { levels: ['high'] } }],
      },
      {
        name: 'team-claude',
        'experimental-cch-signing': true,
        'future-field': 'preserve',
      }
    );

    expect(payload).toEqual({
      name: 'team-claude',
      'base-url': 'https://claude.example.com',
      'api-key-entries': [
        {
          'api-key': 'key-a',
          name: 'account-a',
          'proxy-url': 'http://127.0.0.1:7890',
          weight: 5,
          'auth-index': 'claude:account-a',
        },
      ],
      models: [{ name: 'claude-sonnet-4', thinking: { levels: ['high'] } }],
      'experimental-cch-signing': true,
      'future-field': 'preserve',
    });
  });
});
