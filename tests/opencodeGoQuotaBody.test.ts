import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index';
import { OpenCodeGoQuotaBody } from '../src/features/quota/providers/opencodeGo/OpenCodeGoQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '../src/features/quota/types';
import type { OpenCodeGoQuotaState } from '../src/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test'
);

describe('OpenCode Go quota body', () => {
  test('renders exhausted quota and referral preview without applying referral', () => {
    const quota: OpenCodeGoQuotaState = {
      status: 'success',
      identity: {
        provider: 'opencode-go',
        entry: 'entry-a',
        workspace: 'workspace-a',
        project: '',
        protocol: 'openai',
        alias: '',
        label: 'Team workspace',
        identityKey: 'workspace:workspace-a',
        status: 'runtime-only',
        diagnostic: 'runtime-only',
        diagnostics: [],
        keySource: 'workspace',
        labelSource: 'label',
        ignoredUnsafeFields: [],
      },
      diagnostic: 'runtime-only',
      referralCode: 'REF-123',
      referralUrl: 'https://example.test/ref',
      windows: [
        {
          id: 'monthly',
          label: 'monthly',
          usedPercent: 100,
          resetLabel: 'tomorrow',
          resetAtMs: new Date('2099-08-01T00:00:00Z').getTime(),
          periodHours: 720,
        },
      ],
    };

    const markup = renderToStaticMarkup(createElement(OpenCodeGoQuotaBody, { quota, classes }));

    expect(markup).toContain('Team workspace');
    expect(markup).toContain('REF-123');
    expect(markup).toContain('0%');
    expect(markup).not.toContain('Apply');
  });
});
