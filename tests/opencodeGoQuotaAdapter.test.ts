import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { apiClient } from '../src/services/api/client';
import i18n from '../src/i18n';
import { classifyQuotaFiles } from '../src/features/quota/logic';
import { OPENCODE_GO_CONFIG } from '../src/features/quota/providers/opencodeGo/data';
import { OpenCodeGoQuotaBody } from '../src/features/quota/providers/opencodeGo/OpenCodeGoQuotaBody';
import { useQuotaStore } from '../src/stores/useQuotaStore';
import type { AuthFileItem, OpenCodeGoQuotaState } from '../src/types';
import type { QuotaClassMap } from '../src/features/quota/types';

type ApiClientPatch = {
  get: (url: string) => Promise<unknown>;
  post: (url: string, data?: unknown) => Promise<unknown>;
};

const client = apiClient as unknown as ApiClientPatch;
const originalGet = client.get.bind(apiClient);
const originalPost = client.post.bind(apiClient);

const t = ((key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? key) as TFunction;

const classes = new Proxy(
  {},
  {
    get: (_target, key) => String(key),
  }
) as QuotaClassMap;

const opencodeFile = (
  name: string,
  workspace: string,
  entry: string,
  extra: Partial<AuthFileItem> = {}
): AuthFileItem =>
  ({
    name,
    provider: 'codex',
    opencodeGoIdentity: {
      provider: 'opencode-go',
      workspace,
      entry,
      label: 'Team workspace',
      labelSource: 'label',
    },
    ...extra,
  }) as AuthFileItem;

const renderBody = (quota: OpenCodeGoQuotaState): string =>
  renderToStaticMarkup(React.createElement(OpenCodeGoQuotaBody, { quota, classes }));

describe('OpenCode Go quota adapter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useQuotaStore.getState().clearQuotaCache();
  });

  afterEach(() => {
    client.get = originalGet;
    client.post = originalPost;
    useQuotaStore.getState().clearQuotaCache();
  });

  test('owns duplicate workspace virtual entries with one request and cache key', async () => {
    const postUrls: string[] = [];
    const getUrls: string[] = [];
    client.post = async (url) => {
      postUrls.push(url);
      return {
        groups: [
          {
            provider: 'opencode-go',
            entry: 'runtime-entry',
            workspace: 'workspace-a',
            label: 'Team workspace',
            windows: [{ id: 'weekly', label: 'Weekly limit', usedPercent: 25, resetLabel: 'soon' }],
          },
        ],
      };
    };
    client.get = async (url) => {
      getUrls.push(url);
      return { code: 'OPEN-TEAM', url: 'https://example.test/referral' };
    };

    const entries = classifyQuotaFiles([
      opencodeFile('opencode-openai.json', 'workspace-a', 'runtime-entry'),
      opencodeFile('opencode-anthropic.json', ' workspace-a ', 'configured-entry'),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('opencode-go');
    expect(entries[0]?.cacheKey).toBe('workspace:workspace-a');

    const data = await OPENCODE_GO_CONFIG.fetchQuota(entries[0]!.file, t);
    useQuotaStore.getState().setOpencodeGoQuota({
      [entries[0]!.cacheKey]: OPENCODE_GO_CONFIG.buildSuccessState(data),
    });

    expect(postUrls).toEqual(['/opencode-go/quota/runtime-entry/refresh']);
    expect(getUrls).toEqual(['/opencode-go/referral/workspace-a']);
    expect(getUrls.join(' ')).not.toContain('apply');
    expect(Object.keys(useQuotaStore.getState().opencodeGoQuota)).toEqual([
      'workspace:workspace-a',
    ]);
    expect(useQuotaStore.getState().codexQuota).toEqual({});

    const html = renderBody(useQuotaStore.getState().opencodeGoQuota['workspace:workspace-a']!);
    expect(html).toContain('Referral preview');
    expect(html).toContain('OPEN-TEAM');
    expect(html).toContain('75%');
  });

  test('refreshes legacy entry names and renders rolling weekly monthly quota payloads', async () => {
    const postUrls: string[] = [];
    client.post = async (url) => {
      postUrls.push(url);
      return {
        'entry-name': 'opencode-go:openai:legacy-entry',
        quota: {
          rolling: { percentRemaining: 80, resetInSec: 3600 },
          weekly: { percentRemaining: 40, resetInSec: 90_000 },
          monthly: { percentRemaining: 10, resetInSec: 0 },
        },
        timestamp: '2026-08-02T14:00:00Z',
      };
    };
    client.get = async () => ({});

    const data = await OPENCODE_GO_CONFIG.fetchQuota(
      {
        name: 'shadow-file-name.json',
        provider: 'opencode-go',
        authIndex: 'shadow-auth-index',
        workspaceId: 'workspace-legacy',
        opencode_go_entry_name: 'opencode-go:openai:legacy-entry',
      } as AuthFileItem,
      t
    );
    const html = renderBody(OPENCODE_GO_CONFIG.buildSuccessState(data));

    expect(postUrls).toEqual([
      '/opencode-go/quota/opencode-go%3Aopenai%3Alegacy-entry/refresh',
    ]);
    expect(html).toContain('Rolling');
    expect(html).toContain('Weekly');
    expect(html).toContain('Monthly');
    expect(html).toContain('80%');
    expect(html).toContain('Refreshes in 1h 0m');
    expect(html).not.toContain('Please update the CPA version');
  });

  test('renders missing identity as an explicit diagnostic without an upstream call', async () => {
    let postCount = 0;
    client.post = async () => {
      postCount += 1;
      return {};
    };
    client.get = async () => {
      throw new Error('unexpected referral call');
    };

    const data = await OPENCODE_GO_CONFIG.fetchQuota(
      {
        name: '',
        provider: 'opencode-go',
        opencodeGoIdentity: { provider: 'opencode-go' },
      } as AuthFileItem,
      t
    );
    const state = OPENCODE_GO_CONFIG.buildSuccessState(data);

    expect(postCount).toBe(0);
    expect(renderBody(state)).toContain('Missing workspace identity');
  });

  test('renders exhausted credentials as diagnostics when quota rows are absent', async () => {
    client.post = async () => ({ groups: [] });
    client.get = async () => {
      throw new Error('unexpected referral call');
    };

    const data = await OPENCODE_GO_CONFIG.fetchQuota(
      opencodeFile('opencode-exhausted.json', 'workspace-b', 'entry-b', {
        status: 'monthly_exhausted',
      }),
      t
    );
    const html = renderBody(OPENCODE_GO_CONFIG.buildSuccessState(data));

    expect(html).toContain('monthly_exhausted');
    expect(html).toContain('No quota windows reported');
  });
});
