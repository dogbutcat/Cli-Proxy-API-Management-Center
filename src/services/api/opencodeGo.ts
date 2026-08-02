import type {
  OpenCodeGoEntry,
  OpenCodeGoIdentity,
  OpenCodeGoIdentityInput,
  OpenCodeGoIdentityKeySource,
  OpenCodeGoIdentityLabelSource,
  OpenCodeGoIdentityStatus,
  OpenCodeGoQuotaEntry,
  OpenCodeGoQuotaIdentityGroup,
  OpenCodeGoQuotaResponse,
  OpenCodeGoQuotaGroup,
  OpenCodeGoQuotaGroupWire,
  OpenCodeGoReferralResponse,
  OpenCodeGoResponse,
} from '../../types/opencodeGo';
import type { CodexQuotaWindow, CodexUsagePayload, CodexUsageWindow } from '../../types/quota';
import { parseCodexUsagePayload } from '../../utils/quota/parsers';

export const OPENCODE_GO_ROUTE = '/opencode-go';
export const OPENCODE_GO_QUOTA_ROUTE = '/opencode-go/quota';

const STATUS_SET = new Set<OpenCodeGoIdentityStatus>([
  'canonical',
  'legacy',
  'runtime-only',
  'configured-pending',
  'empty',
]);

const UNSAFE_FIELD_KEYS = [
  'account',
  'apiKey',
  'api_key',
  'api-key',
  'cookie',
  'cookies',
  'authorization',
  'Authorization',
];

const readText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readOptionalRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = readFirstText(...value);
      if (found) return found;
      continue;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const found = readFirstText(record.alias, record.name, record.id, record.label);
      if (found) return found;
      continue;
    }

    const text = readText(value);
    if (text) return text;
  }
  return '';
};

const keySegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');

const readHeaderRecord = (input: OpenCodeGoIdentityInput): Record<string, unknown> =>
  readRecord(input.headers);

const hasMeaningfulUnsafeValue = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const collectUnsafeFields = (input: OpenCodeGoIdentityInput): string[] => {
  const found = new Set<string>();

  UNSAFE_FIELD_KEYS.forEach((key) => {
    if (hasMeaningfulUnsafeValue(input[key])) found.add(key);
  });

  const headers = readHeaderRecord(input);
  Object.entries(headers).forEach(([key, value]) => {
    const normalized = key.trim().toLowerCase();
    if (
      (normalized === 'authorization' || normalized === 'cookie') &&
      hasMeaningfulUnsafeValue(value)
    ) {
      found.add(`headers.${key}`);
    }
  });

  return Array.from(found).sort((left, right) => left.localeCompare(right));
};

const resolveStatus = (
  input: OpenCodeGoIdentityInput,
  keySource: OpenCodeGoIdentityKeySource,
  labelSource: OpenCodeGoIdentityLabelSource
): OpenCodeGoIdentityStatus => {
  const explicit = readText(input.status).toLowerCase();
  if (STATUS_SET.has(explicit as OpenCodeGoIdentityStatus)) {
    return explicit as OpenCodeGoIdentityStatus;
  }
  if (keySource === 'empty' && labelSource === 'empty') return 'empty';
  if (readBoolean(input.runtimeOnly) || readText(input.source).toLowerCase() === 'runtime') {
    return 'runtime-only';
  }
  if (readBoolean(input.configuredPending) || readBoolean(input.configured)) {
    return 'configured-pending';
  }
  if (keySource === 'entry') return 'legacy';
  if (readBoolean(input.legacy)) return 'legacy';
  return readBoolean(input.canonical) || keySource !== 'empty' || labelSource !== 'empty'
    ? 'canonical'
    : 'empty';
};

const firstKeyCandidate = (
  candidates: Array<[OpenCodeGoIdentityKeySource, string]>
): [OpenCodeGoIdentityKeySource, string] => {
  for (const [source, value] of candidates) {
    if (value) return [source, value];
  }
  return ['empty', ''];
};

const firstLabelCandidate = (
  candidates: Array<[OpenCodeGoIdentityLabelSource, string]>
): [OpenCodeGoIdentityLabelSource, string] => {
  for (const [source, value] of candidates) {
    if (value) return [source, value];
  }
  return ['empty', ''];
};

export const normalizeOpenCodeGoIdentity = (
  input: OpenCodeGoIdentityInput = {}
): OpenCodeGoIdentity => {
  const alias = readFirstText(input.aliases, input.alias);
  const provider = readFirstText(input.provider, input.type);
  const entry = readFirstText(
    input.entry,
    input.entryId,
    input.entry_id,
    input.authIndex,
    input.auth_index
  );
  const workspace = readFirstText(input.workspace, input.workspaceId, input.workspace_id);
  const project = readFirstText(input.project, input.projectId, input.project_id);
  const protocol = readFirstText(input.protocol, input.protocol_type);
  const labelFallback = readFirstText(
    input.label,
    input.displayName,
    input.display_name,
    input.title
  );
  const [keySource, keyValue] = firstKeyCandidate([
    ['workspace', workspace],
    ['project', project],
    ['entry', entry],
  ]);
  const [labelSource, label] = firstLabelCandidate([
    ['alias', alias],
    ['provider', provider],
    ['entry', entry],
    ['workspace', workspace],
    ['project', project],
    ['protocol', protocol],
    ['label', labelFallback],
  ]);
  const identityKey = keySource === 'empty' ? '' : `${keySource}:${keySegment(keyValue)}`;
  const ignoredUnsafeFields = collectUnsafeFields(input);
  const status = resolveStatus(input, keySource, labelSource);
  const diagnostic = {
    status,
    keySource,
    labelSource,
    ignoredUnsafeFields,
  };

  return {
    provider,
    entry,
    workspace,
    project,
    protocol,
    alias,
    label,
    identityKey,
    status,
    diagnostic: status,
    diagnostics: [diagnostic],
    keySource,
    labelSource,
    ignoredUnsafeFields,
  };
};

export const normalizeOpenCodeGoSourceIdentity = (
  source: OpenCodeGoIdentityInput = {}
): OpenCodeGoIdentity => normalizeOpenCodeGoIdentity(source);

const mergeIdentityPayload = (wire: OpenCodeGoQuotaGroupWire): OpenCodeGoIdentityInput => {
  const nested =
    readOptionalRecord(wire.identity) ??
    readOptionalRecord(wire.sourceIdentity) ??
    readOptionalRecord(wire.source_identity) ??
    {};

  return {
    ...wire,
    ...nested,
    provider: nested.provider ?? wire.provider,
    entry:
      nested.entry ??
      nested.entryId ??
      nested.entry_id ??
      wire.entry ??
      wire.entryId ??
      wire.entry_id ??
      wire.authIndex ??
      wire.auth_index,
    workspace: nested.workspace ?? wire.workspace ?? wire.workspaceId ?? wire.workspace_id,
    project: nested.project ?? wire.project ?? wire.projectId ?? wire.project_id,
    protocol: nested.protocol ?? wire.protocol ?? wire.protocol_type,
    aliases: nested.aliases ?? nested.alias ?? wire.aliases ?? wire.alias,
    label:
      nested.label ?? nested.displayName ?? wire.label ?? wire.displayName ?? wire.display_name,
  };
};

export const normalizeOpenCodeGoQuotaGroup = (
  wire: OpenCodeGoQuotaGroupWire,
  index = 0
): OpenCodeGoQuotaGroup => {
  const identity = normalizeOpenCodeGoIdentity(mergeIdentityPayload(wire));
  const id = readFirstText(wire.id, identity.identityKey) || `empty:${index}`;

  return {
    id,
    label: identity.label,
    provider: identity.provider,
    entry: identity.entry,
    workspace: identity.workspace,
    protocol: identity.protocol,
    identity,
    raw: wire,
  };
};

export const normalizeOpenCodeGoQuotaGroups = (payload: unknown): OpenCodeGoQuotaGroup[] => {
  const record = readRecord(payload);
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(record.groups)
      ? record.groups
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.rows)
          ? record.rows
          : [];

  return source
    .filter(isPlainRecord)
    .map((item) => item as OpenCodeGoQuotaGroupWire)
    .map((item, index) => normalizeOpenCodeGoQuotaGroup(item, index));
};

const extractWireEntries = <TEntry extends Record<string, unknown>>(
  payload: unknown,
  keys: string[]
): TEntry[] => {
  if (Array.isArray(payload)) return payload.filter(isPlainRecord) as TEntry[];
  const record = readRecord(payload);
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(isPlainRecord) as TEntry[];
  }
  return [];
};

const collectDiagnostics = (
  entries: Array<{ identity: OpenCodeGoIdentity }>
): OpenCodeGoIdentityStatus[] => {
  const diagnostics = new Set<OpenCodeGoIdentityStatus>();
  entries.forEach((entry) => diagnostics.add(entry.identity.status));
  if (diagnostics.size === 0) diagnostics.add('empty');
  return Array.from(diagnostics);
};

export const normalizeOpenCodeGoResponse = (payload: unknown): OpenCodeGoResponse => {
  const entries = extractWireEntries<OpenCodeGoIdentityInput>(payload, [
    'entries',
    'items',
    'workspaces',
  ]).map((raw): OpenCodeGoEntry => ({
    identity: normalizeOpenCodeGoIdentity({ canonical: true, ...raw }),
    raw,
  }));

  return { entries, diagnostics: collectDiagnostics(entries) };
};

const readQuotaWindows = (value: unknown): CodexQuotaWindow[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).reduce<CodexQuotaWindow[]>((windows, item, index) => {
    const id = readFirstText(item.id, item.bucketId, item.bucket_id) || `window-${index}`;
    const label = readFirstText(item.label, item.displayName, item.display_name, id);
    windows.push({
      id,
      label,
      usedPercent: readNumber(item.usedPercent ?? item.used_percent),
      resetLabel: readFirstText(item.resetLabel, item.reset_label, item.resetTime, item.reset_time),
    });
    return windows;
  }, []);
};

const readUsagePayload = (wire: OpenCodeGoQuotaGroupWire): CodexUsagePayload | null =>
  parseCodexUsagePayload(wire.quota ?? wire.usage);

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUsageWindow = (
  id: string,
  label: string,
  window: CodexUsageWindow | null | undefined
): CodexQuotaWindow | null => {
  if (!window) return null;
  return {
    id,
    label,
    usedPercent: readNumber(window.used_percent ?? window.usedPercent),
    resetLabel: '-',
  };
};

const buildUsageWindows = (usage: CodexUsagePayload | null): CodexQuotaWindow[] => {
  if (!usage) return [];
  const rateLimit = usage.rate_limit ?? usage.rateLimit ?? null;
  const codeReviewLimit = usage.code_review_rate_limit ?? usage.codeReviewRateLimit ?? null;
  return [
    normalizeUsageWindow('primary-window', 'primary-window', rateLimit?.primary_window),
    normalizeUsageWindow('secondary-window', 'secondary-window', rateLimit?.secondary_window),
    normalizeUsageWindow(
      'code-review-primary-window',
      'code-review-primary-window',
      codeReviewLimit?.primary_window
    ),
    normalizeUsageWindow(
      'code-review-secondary-window',
      'code-review-secondary-window',
      codeReviewLimit?.secondary_window
    ),
  ].filter((window): window is CodexQuotaWindow => window !== null);
};

export const normalizeOpenCodeGoQuotaResponse = (payload: unknown): OpenCodeGoQuotaResponse => {
  const entries = extractWireEntries<OpenCodeGoQuotaGroupWire>(payload, [
    'entries',
    'items',
    'quotas',
    'groups',
    'rows',
  ]).map((raw): OpenCodeGoQuotaEntry => {
    const usage = readUsagePayload(raw);
    return {
      identity: normalizeOpenCodeGoIdentity({ canonical: true, ...mergeIdentityPayload(raw) }),
      windows: readQuotaWindows(raw.windows),
      usage,
      raw,
    };
  });

  const groupMap = new Map<string, OpenCodeGoQuotaIdentityGroup>();
  entries.forEach((entry, index) => {
    const identityKey = entry.identity.identityKey || `empty-${index}`;
    const windows = entry.windows.length
      ? entry.windows
      : entry.usage
        ? buildUsageWindows(entry.usage)
        : [];
    const existing = groupMap.get(identityKey);
    if (existing) {
      existing.entries.push(entry);
      existing.windows.push(...windows);
      return;
    }
    groupMap.set(identityKey, {
      identityKey,
      identity: entry.identity,
      entries: [entry],
      windows: [...windows],
      diagnostic: entry.identity.status,
    });
  });

  return {
    groups: Array.from(groupMap.values()),
    entries,
    diagnostics: collectDiagnostics(entries),
  };
};

export const opencodeGoApi = {
  list: async (): Promise<OpenCodeGoResponse> => {
    const { apiClient } = await import('./client');
    return normalizeOpenCodeGoResponse(await apiClient.get<unknown>(OPENCODE_GO_ROUTE));
  },

  getQuota: async (): Promise<OpenCodeGoQuotaResponse> => {
    const { apiClient } = await import('./client');
    return normalizeOpenCodeGoQuotaResponse(await apiClient.get<unknown>(OPENCODE_GO_QUOTA_ROUTE));
  },

  refreshQuota: async (entry: string): Promise<OpenCodeGoQuotaResponse> => {
    const { apiClient } = await import('./client');
    return normalizeOpenCodeGoQuotaResponse(
      await apiClient.post<unknown>(
        `${OPENCODE_GO_QUOTA_ROUTE}/${encodeURIComponent(readText(entry))}/refresh`
      )
    );
  },

  getReferral: async (workspace: string): Promise<OpenCodeGoReferralResponse> => {
    const { apiClient } = await import('./client');
    const raw = await apiClient.get<unknown>(
      `${OPENCODE_GO_ROUTE}/referral/${encodeURIComponent(readText(workspace))}`
    );
    const record = readRecord(raw);
    return {
      workspace: readText(workspace),
      code: readText(record.code) || undefined,
      url: readText(record.url) || undefined,
      raw,
    };
  },
};
