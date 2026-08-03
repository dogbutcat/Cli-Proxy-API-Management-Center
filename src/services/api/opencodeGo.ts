import type {
  OpenCodeGoEntry,
  OpenCodeGoConfig,
  OpenCodeGoIdentity,
  OpenCodeGoIdentityInput,
  OpenCodeGoIdentityKeySource,
  OpenCodeGoIdentityLabelSource,
  OpenCodeGoIdentityStatus,
  OpenCodeGoKeyEntry,
  OpenCodeGoKeyGroup,
  OpenCodeGoModelEntry,
  OpenCodeGoProtocolConfig,
  OpenCodeGoQuotaConfig,
  OpenCodeGoQuotaEntry,
  OpenCodeGoQuotaIdentityGroup,
  OpenCodeGoQuotaResult,
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

const readOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readRecordList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isPlainRecord) : [];

const readOptionalRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const looksLikeLegacyQuotaResult = (obj: Record<string, unknown>): boolean =>
  typeof obj.entry_name === 'string' ||
  typeof obj['entry-name'] === 'string' ||
  typeof obj.entryName === 'string' ||
  isPlainRecord(obj.quota);

export const normalizeQuotaResult = (data: unknown): OpenCodeGoQuotaResult => {
  const wrapped =
    isPlainRecord(data) && isPlainRecord(data.quota) && looksLikeLegacyQuotaResult(data.quota)
      ? data.quota
      : data;
  if (!isPlainRecord(wrapped)) {
    return { entry_name: '', timestamp: '', error: 'Invalid quota response' };
  }

  return {
    entry_name:
      readText(wrapped.entry_name) || readText(wrapped['entry-name']) || readText(wrapped.entryName),
    quota: isPlainRecord(wrapped.quota)
      ? (wrapped.quota as OpenCodeGoQuotaResult['quota'])
      : undefined,
    error: readText(wrapped.error) || undefined,
    timestamp: readText(wrapped.timestamp),
  };
};

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
    input.opencodeGoEntryName,
    input.opencode_go_entry_name,
    input.id,
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

const normalizeOpenCodeGoModelEntry = (item: unknown): OpenCodeGoModelEntry | null => {
  if (typeof item === 'string') {
    const name = item.trim();
    return name ? { name } : null;
  }
  if (!isPlainRecord(item)) return null;
  const name = readText(item.name);
  if (!name) return null;
  const alias = readText(item.alias);
  return {
    name,
    ...(alias ? { alias } : {}),
    ...(item.raw ? { raw: readRecord(item.raw) } : {}),
  };
};

const normalizeOpenCodeGoProtocolConfig = (
  value: unknown
): OpenCodeGoProtocolConfig | undefined => {
  if (!isPlainRecord(value)) return undefined;
  const baseUrl = readText(value['base-url'] ?? value.baseUrl);
  const models = Array.isArray(value.models)
    ? value.models.map((item) => normalizeOpenCodeGoModelEntry(item)).filter(Boolean)
    : [];
  const priority = readOptionalNumber(value.priority);
  return {
    baseUrl,
    nameSuffix: readText(value['name-suffix'] ?? value.nameSuffix) || undefined,
    prefix: readText(value.prefix) || undefined,
    priority,
    models: models.length ? (models as OpenCodeGoModelEntry[]) : undefined,
    raw: value,
  };
};

const normalizeOpenCodeGoKeyEntry = (value: unknown): OpenCodeGoKeyEntry | null => {
  if (!isPlainRecord(value)) return null;
  const keyName = readText(value['key-name'] ?? value.keyName);
  const apiKey = readText(value['api-key'] ?? value.apiKey);
  if (!keyName && !apiKey) return null;
  const authIndicesRaw = readRecord(
    value['auth-indices'] ?? value.authIndices ?? value['auth-indexes'] ?? value.authIndexes
  );
  const authIndices = Object.fromEntries(
    Object.entries(authIndicesRaw)
      .map(([key, entryValue]) => [key.trim(), readText(entryValue)] as const)
      .filter(([key, entryValue]) => key && entryValue)
  );
  return {
    keyName,
    apiKey,
    proxyUrl: readText(value['proxy-url'] ?? value.proxyUrl) || undefined,
    workspaceId: readText(value['workspace-id'] ?? value.workspaceId) || undefined,
    authCookie: readText(value['auth-cookie'] ?? value.authCookie) || undefined,
    authIndices: Object.keys(authIndices).length ? authIndices : undefined,
    raw: value,
  };
};

export const normalizeOpenCodeGoKeyGroup = (
  value: unknown,
  index = 0
): OpenCodeGoKeyGroup | null => {
  if (!isPlainRecord(value)) return null;
  const namePrefix = readText(value['name-prefix'] ?? value.namePrefix) || `opencode-go-${index}`;
  const keys = readRecordList(value.keys)
    .map((item) => normalizeOpenCodeGoKeyEntry(item))
    .filter(Boolean) as OpenCodeGoKeyEntry[];
  const openai = normalizeOpenCodeGoProtocolConfig(value.openai);
  const anthropic = normalizeOpenCodeGoProtocolConfig(value.anthropic);
  const firstKey = keys[0];
  const identity = normalizeOpenCodeGoIdentity({
    provider: 'opencode-go',
    entry: firstKey?.keyName || namePrefix,
    workspace: firstKey?.workspaceId,
    protocol: openai ? 'openai' : anthropic ? 'anthropic' : undefined,
    label: namePrefix,
    configured: true,
    account: firstKey?.raw?.account,
    apiKey: firstKey?.apiKey,
    cookie: firstKey?.raw?.['auth-cookie'],
  });

  return {
    namePrefix,
    disabled: readBoolean(value.disabled),
    disableCooling: readBoolean(value['disable-cooling'] ?? value.disableCooling),
    headers: isPlainRecord(value.headers) ? (value.headers as Record<string, string>) : undefined,
    openai,
    anthropic,
    keys,
    authIndexes: isPlainRecord(value['auth-indexes'])
      ? (value['auth-indexes'] as Record<string, Record<string, string>>)
      : undefined,
    identity,
    raw: value,
  };
};

const normalizeOpenCodeGoQuotaConfig = (value: unknown): OpenCodeGoQuotaConfig | undefined => {
  if (!isPlainRecord(value)) return undefined;
  const threshold = readOptionalNumber(value.threshold);
  return {
    pollInterval: readText(value['poll-interval'] ?? value.pollInterval) || undefined,
    threshold,
    raw: value,
  };
};

export const normalizeOpenCodeGoConfig = (value: unknown): OpenCodeGoConfig | undefined => {
  if (!isPlainRecord(value)) return undefined;
  const keyGroups = readRecordList(value['key-groups'] ?? value.keyGroups)
    .map((item, index) => normalizeOpenCodeGoKeyGroup(item, index))
    .filter(Boolean) as OpenCodeGoKeyGroup[];
  const quota = normalizeOpenCodeGoQuotaConfig(value.quota);
  return {
    keyGroups,
    ...(quota ? { quota } : {}),
    raw: value,
  };
};

const serializeOpenCodeGoModels = (models?: OpenCodeGoModelEntry[]): unknown[] | undefined => {
  if (!Array.isArray(models)) return undefined;
  const serialized = models
    .map((model) => {
      const name = readText(model.name);
      if (!name) return null;
      const alias = readText(model.alias);
      return alias ? { name, alias } : name;
    })
    .filter((model) => model !== null);
  return serialized.length ? serialized : undefined;
};

const serializeOpenCodeGoProtocolConfig = (
  protocol?: OpenCodeGoProtocolConfig
): Record<string, unknown> | undefined => {
  if (!protocol) return undefined;
  const payload: Record<string, unknown> = { ...(protocol.raw ?? {}) };
  payload['base-url'] = protocol.baseUrl;
  delete payload.baseUrl;
  if (protocol.nameSuffix) payload['name-suffix'] = protocol.nameSuffix;
  else delete payload['name-suffix'];
  delete payload.nameSuffix;
  if (protocol.prefix) payload.prefix = protocol.prefix;
  else delete payload.prefix;
  if (protocol.priority !== undefined) payload.priority = protocol.priority;
  else delete payload.priority;
  const models = serializeOpenCodeGoModels(protocol.models);
  if (models) payload.models = models;
  else delete payload.models;
  return readText(payload['base-url']) || models ? payload : undefined;
};

const serializeOpenCodeGoKeyEntry = (key: OpenCodeGoKeyEntry): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...(key.raw ?? {}) };
  payload['key-name'] = key.keyName;
  delete payload.keyName;
  payload['api-key'] = key.apiKey;
  delete payload.apiKey;
  if (key.proxyUrl) payload['proxy-url'] = key.proxyUrl;
  else delete payload['proxy-url'];
  delete payload.proxyUrl;
  if (key.workspaceId) payload['workspace-id'] = key.workspaceId;
  else delete payload['workspace-id'];
  delete payload.workspaceId;
  if (key.authCookie) payload['auth-cookie'] = key.authCookie;
  else delete payload['auth-cookie'];
  delete payload.authCookie;
  return payload;
};

const serializeOpenCodeGoKeyGroup = (group: OpenCodeGoKeyGroup): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...(group.raw ?? {}) };
  payload['name-prefix'] = group.namePrefix;
  delete payload.namePrefix;
  if (group.disabled) payload.disabled = true;
  else delete payload.disabled;
  if (group.disableCooling) payload['disable-cooling'] = true;
  else delete payload['disable-cooling'];
  delete payload.disableCooling;
  if (group.headers && Object.keys(group.headers).length) payload.headers = group.headers;
  else delete payload.headers;
  const openai = serializeOpenCodeGoProtocolConfig(group.openai);
  if (openai) payload.openai = openai;
  else delete payload.openai;
  const anthropic = serializeOpenCodeGoProtocolConfig(group.anthropic);
  if (anthropic) payload.anthropic = anthropic;
  else delete payload.anthropic;
  payload.keys = group.keys.map((key) => serializeOpenCodeGoKeyEntry(key));
  return payload;
};

export const serializeOpenCodeGoConfig = (config: OpenCodeGoConfig): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...(config.raw ?? {}) };
  payload['key-groups'] = config.keyGroups.map((group) => serializeOpenCodeGoKeyGroup(group));
  delete payload.keyGroups;
  if (config.quota?.raw) {
    payload.quota = { ...config.quota.raw };
  } else if (config.quota) {
    const quota: Record<string, unknown> = {};
    if (config.quota.pollInterval) quota['poll-interval'] = config.quota.pollInterval;
    if (config.quota.threshold !== undefined) quota.threshold = config.quota.threshold;
    if (Object.keys(quota).length) payload.quota = quota;
  }
  return payload;
};

const normalizeOpenCodeGoManagementResponse = (payload: unknown): OpenCodeGoConfig => {
  const record = readRecord(payload);
  return (
    normalizeOpenCodeGoConfig(record['opencode-go']) ??
    normalizeOpenCodeGoConfig(payload) ?? { keyGroups: [] }
  );
};

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

const formatLegacyResetSeconds = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return '-';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `Refreshes in ${days}d ${hours}h`;
  if (hours > 0) return `Refreshes in ${hours}h ${minutes}m`;
  return `Refreshes in ${minutes}m`;
};

const readLegacyQuotaWindow = (
  quota: Record<string, unknown>,
  key: string,
  label: string
): CodexQuotaWindow | null => {
  const raw = readOptionalRecord(quota[key]);
  if (!raw) return null;
  const remaining = readNumber(raw.percentRemaining ?? raw.percent_remaining);
  const used = readNumber(raw.usedPercent ?? raw.used_percent);
  const usedPercent = remaining !== null ? 100 - remaining : used;
  return {
    id: key,
    label,
    usedPercent,
    resetLabel: formatLegacyResetSeconds(readNumber(raw.resetInSec ?? raw.reset_in_sec)),
  };
};

const buildLegacyQuotaWindows = (quota: Record<string, unknown>): CodexQuotaWindow[] =>
  [
    readLegacyQuotaWindow(quota, 'rolling', 'Rolling'),
    readLegacyQuotaWindow(quota, 'weekly', 'Weekly'),
    readLegacyQuotaWindow(quota, 'monthly', 'Monthly'),
  ].filter((window): window is CodexQuotaWindow => window !== null);

const looksLikeLegacyQuotaWindows = (value: unknown): value is Record<string, unknown> => {
  const quota = readOptionalRecord(value);
  if (!quota) return false;
  return ['rolling', 'weekly', 'monthly'].some((key) => readOptionalRecord(quota[key]) !== null);
};

const extractLegacyQuotaResult = (
  payload: unknown
): { record: Record<string, unknown>; quota: Record<string, unknown> } | null => {
  const record = readRecord(payload);
  if (looksLikeLegacyQuotaWindows(record.quota)) {
    return { record, quota: readRecord(record.quota) };
  }

  const wrapped = readOptionalRecord(record.quota);
  if (wrapped && looksLikeLegacyQuotaWindows(wrapped.quota)) {
    return { record: wrapped, quota: readRecord(wrapped.quota) };
  }

  if (looksLikeLegacyQuotaWindows(record)) {
    return { record, quota: record };
  }

  return null;
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
  const legacy = extractLegacyQuotaResult(payload);
  if (legacy) {
    const entry = {
      identity: normalizeOpenCodeGoIdentity({
        provider: 'opencode-go',
        entry: readFirstText(
          legacy.record.entry,
          legacy.record.entryName,
          legacy.record.entry_name,
          legacy.record['entry-name']
        ),
        legacy: true,
      }),
      windows: buildLegacyQuotaWindows(legacy.quota),
      usage: null,
      raw: legacy.record,
    };
    const identityKey = entry.identity.identityKey || 'legacy:quota';
    return {
      groups: [
        {
          identityKey,
          identity: entry.identity,
          entries: [entry],
          windows: [...entry.windows],
          diagnostic: entry.identity.status,
        },
      ],
      entries: [entry],
      diagnostics: collectDiagnostics([entry]),
    };
  }

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

  refreshQuotaByEntryName: async (entry: string): Promise<OpenCodeGoQuotaResult> => {
    const { apiClient } = await import('./client');
    return normalizeQuotaResult(
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

  listKeyGroups: async (): Promise<OpenCodeGoKeyGroup[]> => {
    const { apiClient } = await import('./client');
    const raw = await apiClient.get<unknown>(OPENCODE_GO_ROUTE);
    return normalizeOpenCodeGoManagementResponse(raw).keyGroups;
  },

  putKeyGroups: async (groups: OpenCodeGoKeyGroup[]): Promise<OpenCodeGoKeyGroup[]> => {
    const { apiClient } = await import('./client');
    const raw = await apiClient.put<unknown>(OPENCODE_GO_ROUTE, {
      'key-groups': groups.map((group) => serializeOpenCodeGoKeyGroup(group)),
    });
    return normalizeOpenCodeGoManagementResponse(raw).keyGroups;
  },

  upsertKeyGroup: async (
    group: OpenCodeGoKeyGroup,
    selector?: { index?: number; namePrefix?: string }
  ): Promise<OpenCodeGoKeyGroup[]> => {
    const { apiClient } = await import('./client');
    const raw = await apiClient.patch<unknown>(OPENCODE_GO_ROUTE, {
      ...(selector?.index !== undefined ? { index: selector.index } : {}),
      ...(selector?.namePrefix ? { 'name-prefix': selector.namePrefix } : {}),
      value: serializeOpenCodeGoKeyGroup(group),
    });
    return normalizeOpenCodeGoManagementResponse(raw).keyGroups;
  },

  deleteKeyGroup: async (selector: { index?: number; namePrefix?: string }): Promise<void> => {
    const { apiClient } = await import('./client');
    const query =
      selector.index !== undefined
        ? `index=${encodeURIComponent(String(selector.index))}`
        : `name-prefix=${encodeURIComponent(readText(selector.namePrefix))}`;
    await apiClient.delete(`${OPENCODE_GO_ROUTE}?${query}`);
  },

  deleteKeyGroups: async (namePrefixes: string[]): Promise<void> => {
    const removeSet = new Set(namePrefixes.map((name) => name.trim()).filter(Boolean));
    const existing = await opencodeGoApi.listKeyGroups();
    await opencodeGoApi.putKeyGroups(existing.filter((group) => !removeSet.has(group.namePrefix)));
  },

  updateKeyGroupsDisabled: async (namePrefixes: string[], disabled: boolean): Promise<void> => {
    const targetSet = new Set(namePrefixes.map((name) => name.trim()).filter(Boolean));
    const existing = await opencodeGoApi.listKeyGroups();
    await opencodeGoApi.putKeyGroups(
      existing.map((group) => (targetSet.has(group.namePrefix) ? { ...group, disabled } : group))
    );
  },
};
