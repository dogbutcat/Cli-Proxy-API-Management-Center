import type { CanonicalRoutingStrategy } from '@/types/config';

export type ParsedRoutingStrategy = {
  value: string;
  raw?: string;
  canonical?: CanonicalRoutingStrategy;
  known: boolean;
  explicit: boolean;
};

const ROUTING_STRATEGY_ALIASES: Record<string, CanonicalRoutingStrategy> = {
  roundrobin: 'round-robin',
  rr: 'round-robin',
  fillfirst: 'fill-first',
  ff: 'fill-first',
  weightedroundrobin: 'weighted-round-robin',
  wrr: 'weighted-round-robin',
  seqrandom: 'seq-random',
  sequentialrandom: 'seq-random',
  sr: 'seq-random',
};

const normalizeRoutingStrategyKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, '');

export function parseConfigRoutingStrategy(raw: unknown): ParsedRoutingStrategy {
  if (raw === undefined || raw === null) {
    return {
      value: 'round-robin',
      canonical: 'round-robin',
      known: true,
      explicit: false,
    };
  }

  const rawValue = String(raw);
  const key = normalizeRoutingStrategyKey(rawValue);
  const canonical = ROUTING_STRATEGY_ALIASES[key];

  if (canonical) {
    return {
      value: canonical,
      raw: rawValue,
      canonical,
      known: true,
      explicit: true,
    };
  }

  return {
    value: rawValue,
    raw: rawValue,
    known: false,
    explicit: true,
  };
}

export function serializeConfigRoutingStrategy(value: unknown): string {
  const parsed = parseConfigRoutingStrategy(value);
  return parsed.canonical ?? parsed.value;
}
