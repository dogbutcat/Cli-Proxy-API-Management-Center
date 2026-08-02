import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse as parseYaml } from 'yaml';
import type { VisualConfigValues } from '../src/types/visualConfig';
import { parseRoutingStrategy, useVisualConfig } from '../src/hooks/useVisualConfig';
import { getRoutingStrategyOptions } from '../src/features/dashboard/utils';

function renderAppliedYaml(
  currentYaml: string,
  patch: Partial<VisualConfigValues>,
  loadYaml = currentYaml
): string {
  function Harness() {
    const visualConfig = useVisualConfig();
    const [phase, setPhase] = useState(0);

    if (phase === 0) {
      visualConfig.loadVisualValuesFromYaml(loadYaml);
      setPhase(1);
      return null;
    }

    if (phase === 1) {
      visualConfig.setVisualValues(patch);
      setPhase(2);
      return null;
    }

    return createElement('pre', null, visualConfig.applyVisualChangesToYaml(currentYaml));
  }

  const markup = renderToStaticMarkup(createElement(Harness));
  return markup.slice('<pre>'.length, -'</pre>'.length);
}

describe('visual config routing strategy', () => {
  test('offers all canonical routing strategies and preserves unknown display values', () => {
    const t = ((key: string, options?: { value?: string }) => {
      const labels: Record<string, string> = {
        'basic_settings.routing_strategy_round_robin': 'RR',
        'basic_settings.routing_strategy_weighted_round_robin': 'WRR',
        'basic_settings.routing_strategy_fill_first': 'FF',
        'basic_settings.routing_strategy_seq_random': 'SR',
      };
      return labels[key] ?? `Unknown (${options?.value ?? ''})`;
    }) as Parameters<typeof getRoutingStrategyOptions>[0];

    expect(getRoutingStrategyOptions(t).map((option) => option.value)).toEqual([
      'round-robin',
      'weighted-round-robin',
      'fill-first',
      'seq-random',
    ]);
    expect(getRoutingStrategyOptions(t, 'custom-routing')).toContainEqual({
      value: 'custom-routing',
      label: 'Unknown (custom-routing)',
    });
  });

  test('recognizes backend values and safe aliases', () => {
    expect(parseRoutingStrategy('round-robin')).toBe('round-robin');
    expect(parseRoutingStrategy('roundrobin')).toBe('round-robin');
    expect(parseRoutingStrategy('round_robin')).toBe('round-robin');
    expect(parseRoutingStrategy('rr')).toBe('round-robin');
    expect(parseRoutingStrategy('weighted-round-robin')).toBe('weighted-round-robin');
    expect(parseRoutingStrategy('weightedroundrobin')).toBe('weighted-round-robin');
    expect(parseRoutingStrategy('weighted_round_robin')).toBe('weighted-round-robin');
    expect(parseRoutingStrategy('wrr')).toBe('weighted-round-robin');
    expect(parseRoutingStrategy('fill-first')).toBe('fill-first');
    expect(parseRoutingStrategy('fillfirst')).toBe('fill-first');
    expect(parseRoutingStrategy('fill_first')).toBe('fill-first');
    expect(parseRoutingStrategy('ff')).toBe('fill-first');
    expect(parseRoutingStrategy('seq-random')).toBe('seq-random');
    expect(parseRoutingStrategy('seqrandom')).toBe('seq-random');
    expect(parseRoutingStrategy('sequential-random')).toBe('seq-random');
    expect(parseRoutingStrategy('sequential_random')).toBe('seq-random');
    expect(parseRoutingStrategy('sr')).toBe('seq-random');
    expect(parseRoutingStrategy(undefined)).toBe('round-robin');
  });

  test('preserves unknown raw values instead of coercing to round-robin', () => {
    expect(parseRoutingStrategy('custom-routing')).toBe('custom-routing');

    const result = renderAppliedYaml('routing:\n  strategy: round-robin\n', {
      routingStrategy: 'custom-routing' as VisualConfigValues['routingStrategy'],
    });

    expect(parseYaml(result)).toEqual({ routing: { strategy: 'custom-routing' } });
  });

  test('writes canonical backend values when routing strategy is dirty', () => {
    const wrrResult = renderAppliedYaml('routing:\n  strategy: round-robin\n', {
      routingStrategy: 'wrr' as VisualConfigValues['routingStrategy'],
    });
    const seqResult = renderAppliedYaml('routing:\n  strategy: round-robin\n', {
      routingStrategy: 'sequential-random' as VisualConfigValues['routingStrategy'],
    });

    expect(parseYaml(wrrResult)).toEqual({ routing: { strategy: 'weighted-round-robin' } });
    expect(parseYaml(seqResult)).toEqual({ routing: { strategy: 'seq-random' } });
  });

  test('saving unrelated fields does not rewrite active routing strategy or siblings', () => {
    const yaml = [
      'proxy-url: http://old.example',
      'routing:',
      '  strategy: seqrandom',
      '  session-affinity: false',
      '  weights:',
      '    primary: 0',
      '    backup: 4',
      '  seq-quota:',
      '    remaining: 0',
      '',
    ].join('\n');
    const result = renderAppliedYaml(yaml, { proxyUrl: 'http://new.example' });

    expect(parseYaml(result)).toEqual({
      'proxy-url': 'http://new.example',
      routing: {
        strategy: 'seqrandom',
        'session-affinity': false,
        weights: {
          primary: 0,
          backup: 4,
        },
        'seq-quota': {
          remaining: 0,
        },
      },
    });
  });

  test('changing routing strategy preserves zero weights and seq quota fields', () => {
    const yaml = [
      'routing:',
      '  strategy: round-robin',
      '  weights:',
      '    primary: 0',
      '    backup: 4',
      '  seq-quota:',
      '    remaining: 0',
      '',
    ].join('\n');
    const result = renderAppliedYaml(yaml, {
      routingStrategy: 'weightedroundrobin' as VisualConfigValues['routingStrategy'],
    });

    expect(parseYaml(result)).toEqual({
      routing: {
        strategy: 'weighted-round-robin',
        weights: {
          primary: 0,
          backup: 4,
        },
        'seq-quota': {
          remaining: 0,
        },
      },
    });
  });
});
