/**
 * 日志相关 API
 */

import { apiClient } from './client';
import { LOGS_TIMEOUT_MS } from '@/utils/constants';
import { isRecord } from '@/utils/helpers';
import { normalizeOpenCodeGoSourceIdentity } from './opencodeGo';

export const LOG_QUERY_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;
export type LogsQueryHttpMethod = (typeof LOG_QUERY_HTTP_METHODS)[number];

export const LOG_QUERY_STATUS_GROUPS = ['2xx', '3xx', '4xx', '5xx'] as const;
export type LogsQueryStatusGroup = (typeof LOG_QUERY_STATUS_GROUPS)[number];

export interface LogsQuery {
  after?: number;
  cursor?: string;
  limit?: number;
  search?: string;
  method?: string;
  status?: string;
  path?: string;
  source?: string;
}

export interface LogsResponse {
  lines: string[];
  latestAfter?: number;
  nextCursor?: string;
  cursorReset?: boolean;
}

export interface ErrorLogFile {
  name: string;
  size?: number;
  modified?: number;
}

export interface ErrorLogsResponse {
  files?: ErrorLogFile[];
}

const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const numberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = stringValue(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const booleanValue = (value: unknown): boolean =>
  value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');

const unixSecondsFromValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = stringValue(value);
  if (!text) return 0;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber)) return asNumber;
  const asDate = Date.parse(text);
  return Number.isFinite(asDate) ? Math.floor(asDate / 1000) : 0;
};

const readAlias = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const readFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = readFirstText(...value);
      if (found) return found;
      continue;
    }
    if (isRecord(value)) {
      const found = readFirstText(value.alias, value.name, value.id, value.label);
      if (found) return found;
      continue;
    }
    const text = stringValue(value);
    if (text) return text;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const appendUnique = (target: string[], ...values: string[]) => {
  const seen = new Set(target.map((value) => value.toLowerCase()));
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    target.push(normalized);
  });
};

const readRecordList = (...values: unknown[]): Record<string, unknown>[] => {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    return value.filter(isRecord);
  }
  return [];
};

const findOpenCodeSourcePayload = (record: Record<string, unknown>): Record<string, unknown> => {
  const candidates = [
    readAlias(record, 'source_identity', 'sourceIdentity'),
    readAlias(record, 'opencode_go_identity', 'opencodeGoIdentity', 'identity'),
    record.source,
  ];
  const found = candidates.find(isRecord);
  return found ?? {};
};

export const buildLogRecordSearchText = (entry: unknown): string => {
  if (typeof entry === 'string') return entry;
  if (!isRecord(entry)) return '';

  const parts: string[] = [];
  appendUnique(
    parts,
    readFirstText(readAlias(entry, 'provider', 'auth_provider', 'authProvider')),
    readFirstText(readAlias(entry, 'model', 'resolved_model', 'resolvedModel')),
    readFirstText(readAlias(entry, 'auth_index', 'authIndex')),
    readFirstText(readAlias(entry, 'auth_label', 'authLabel', 'auth_label_snapshot')),
    readFirstText(readAlias(entry, 'source_hash', 'sourceHash')),
    readFirstText(readAlias(entry, 'identity_key', 'identityKey')),
    readFirstText(readAlias(entry, 'workspace', 'workspace_id', 'workspaceId')),
    readFirstText(readAlias(entry, 'entry', 'entry_id', 'entryId')),
    readFirstText(readAlias(entry, 'protocol', 'protocol_type', 'protocolType'))
  );

  const source = entry.source;
  if (typeof source === 'string') {
    appendUnique(parts, source);
  }

  const sourcePayload = findOpenCodeSourcePayload(entry);
  if (Object.keys(sourcePayload).length > 0) {
    const identity = normalizeOpenCodeGoSourceIdentity({
      ...sourcePayload,
      provider:
        sourcePayload.provider ?? readAlias(entry, 'provider', 'auth_provider', 'authProvider'),
      entry: sourcePayload.entry ?? readAlias(entry, 'auth_index', 'authIndex'),
      workspace: sourcePayload.workspace ?? readAlias(entry, 'workspace', 'workspace_id'),
      protocol: sourcePayload.protocol ?? readAlias(entry, 'protocol', 'protocol_type'),
      label: sourcePayload.label ?? readAlias(entry, 'auth_label', 'authLabel'),
    });
    appendUnique(
      parts,
      identity.label,
      identity.provider,
      identity.identityKey,
      identity.workspace,
      identity.entry,
      identity.project,
      identity.protocol,
      identity.alias
    );
  }

  readRecordList(readAlias(entry, 'models', 'model_names', 'modelNames')).forEach((item) => {
    appendUnique(parts, readFirstText(item.name, item.alias, item.id, item.model));
  });

  return parts.join(' ');
};

const buildStructuredLogLine = (entry: Record<string, unknown>): string => {
  const raw = readFirstText(readAlias(entry, 'line', 'raw', 'text'));
  const message = readFirstText(readAlias(entry, 'message', 'msg'));
  const metadata = buildLogRecordSearchText(entry);
  if (raw) return metadata ? `${raw} | ${metadata}` : raw;

  const parts: string[] = [];
  appendUnique(
    parts,
    readFirstText(readAlias(entry, 'timestamp', 'time', 'ts')),
    readFirstText(readAlias(entry, 'level')),
    typeof entry.source === 'string' ? `[${entry.source}]` : '',
    readFirstText(readAlias(entry, 'request_id', 'requestId')),
    readFirstText(readAlias(entry, 'status', 'status_code', 'statusCode')),
    readFirstText(readAlias(entry, 'latency', 'duration')),
    [readFirstText(readAlias(entry, 'method')), readFirstText(readAlias(entry, 'path', 'endpoint'))]
      .filter(Boolean)
      .join(' '),
    message,
    metadata
  );
  return parts.join(' | ');
};

const normalizeLogLines = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (isRecord(entry)) return buildStructuredLogLine(entry);
      return '';
    })
    .filter((line) => line.length > 0);
};

const readLogEntries = (data: Record<string, unknown>): unknown[] =>
  Array.isArray(data.lines)
    ? data.lines
    : Array.isArray(data.entries)
      ? data.entries
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.logs)
          ? data.logs
          : [];

export const normalizeLogsResponse = (data: unknown): LogsResponse => {
  if (!isRecord(data)) {
    return { lines: [] };
  }

  const lines = normalizeLogLines(readLogEntries(data));
  const latestTimestamp = unixSecondsFromValue(
    readAlias(data, 'latest-timestamp', 'latestTimestamp', 'latest_after', 'latestAfter')
  );

  return {
    lines,
    latestAfter: latestTimestamp > 0 ? latestTimestamp : undefined,
    nextCursor:
      stringValue(readAlias(data, 'next-cursor', 'nextCursor', 'next_cursor', 'cursor')) ||
      undefined,
    cursorReset: booleanValue(readAlias(data, 'cursor-reset', 'cursorReset', 'cursor_reset')),
  };
};

export const LOGS_SAFE_QUERY_KEYS = new Set([
  'search',
  'q',
  'source',
  'method',
  'status',
  'path',
  'cursor',
  'after',
  'provider',
  'model',
  'auth_index',
  'source_hash',
  'identity_key',
  'workspace',
  'entry',
  'protocol',
]);

const SEARCH_QUERY_KEYS = [
  'search',
  'q',
  'provider',
  'model',
  'auth_index',
  'source_hash',
  'identity_key',
  'workspace',
  'entry',
  'protocol',
];

const UNSAFE_QUERY_VALUE_REGEX =
  /\b(?:api[_-]?key|authorization|bearer|cookie|session)\b|(?:sk|oc)-[A-Za-z0-9_-]{8,}/i;

const safeQueryValue = (key: string, value: unknown): string => {
  const text =
    typeof value === 'number' && Number.isFinite(value) ? String(value) : stringValue(value);
  if (!text || !LOGS_SAFE_QUERY_KEYS.has(key)) return '';
  if (
    text.length > 240 ||
    [...text].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return '';
  }
  if (UNSAFE_QUERY_VALUE_REGEX.test(text)) return '';
  return text;
};

const splitParamValues = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeMethodFilter = (value: string): LogsQueryHttpMethod | null => {
  const method = value.trim().toUpperCase();
  return LOG_QUERY_HTTP_METHODS.includes(method as LogsQueryHttpMethod)
    ? (method as LogsQueryHttpMethod)
    : null;
};

const normalizeStatusFilter = (value: string): LogsQueryStatusGroup | null => {
  const status = value.trim().toLowerCase();
  if (LOG_QUERY_STATUS_GROUPS.includes(status as LogsQueryStatusGroup)) {
    return status as LogsQueryStatusGroup;
  }
  const code = Number(status);
  if (!Number.isFinite(code)) return null;
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return null;
};

export type LogsStructuredQueryFilters = {
  methods: LogsQueryHttpMethod[];
  statuses: LogsQueryStatusGroup[];
  paths: string[];
  sources: string[];
};

export const buildSafeLogsQuery = (
  input: Record<string, unknown> | URLSearchParams
): Record<string, string> => {
  const output: Record<string, string> = {};
  const entries =
    input instanceof URLSearchParams ? Array.from(input.entries()) : Object.entries(input);

  entries.forEach(([key, value]) => {
    const normalizedKey = key.trim();
    const safeValue = safeQueryValue(normalizedKey, value);
    if (safeValue) output[normalizedKey] = safeValue;
  });

  return output;
};

export const buildSafeLogsPath = (query: Record<string, unknown>): string => {
  const params = new URLSearchParams(buildSafeLogsQuery(query));
  const suffix = params.toString();
  return suffix ? `/logs?${suffix}` : '/logs';
};

export const buildLogsSearchQueryFromParams = (params: URLSearchParams): string => {
  const parts: string[] = [];
  SEARCH_QUERY_KEYS.forEach((key) => {
    params.getAll(key).forEach((value) => {
      appendUnique(parts, ...splitParamValues(safeQueryValue(key, value)));
    });
  });
  return parts.join(' ');
};

export const readLogsStructuredFiltersFromParams = (
  params: URLSearchParams
): LogsStructuredQueryFilters => {
  const methods: LogsQueryHttpMethod[] = [];
  const statuses: LogsQueryStatusGroup[] = [];
  const paths: string[] = [];
  const sources: string[] = [];

  params
    .getAll('method')
    .flatMap(splitParamValues)
    .forEach((value) => {
      const method = normalizeMethodFilter(value);
      if (method && !methods.includes(method)) methods.push(method);
    });

  params
    .getAll('status')
    .flatMap(splitParamValues)
    .forEach((value) => {
      const status = normalizeStatusFilter(value);
      if (status && !statuses.includes(status)) statuses.push(status);
    });

  params
    .getAll('path')
    .flatMap(splitParamValues)
    .forEach((value) => {
      const path = safeQueryValue('path', value);
      if (path && !paths.includes(path)) paths.push(path);
    });

  params
    .getAll('source')
    .flatMap(splitParamValues)
    .forEach((value) => {
      const source = safeQueryValue('source', value);
      if (source && !sources.includes(source)) sources.push(source);
    });

  return { methods, statuses, paths, sources };
};

export const readLogsAfterParam = (params: URLSearchParams): number | undefined => {
  const after = numberValue(safeQueryValue('after', params.get('after')));
  return after !== undefined && after > 0 ? after : undefined;
};

export const logsApi = {
  async fetchLogs(params: LogsQuery = {}): Promise<LogsResponse> {
    const data = await apiClient.get('/logs', { params, timeout: LOGS_TIMEOUT_MS });
    return normalizeLogsResponse(data);
  },

  clearLogs: () => apiClient.delete('/logs'),

  fetchErrorLogs: (): Promise<ErrorLogsResponse> =>
    apiClient.get('/request-error-logs', { timeout: LOGS_TIMEOUT_MS }),

  downloadErrorLog: (filename: string) =>
    apiClient.getRaw(`/request-error-logs/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
      timeout: LOGS_TIMEOUT_MS,
    }),

  downloadRequestLogById: (id: string) =>
    apiClient.getRaw(`/request-log-by-id/${encodeURIComponent(id)}`, {
      responseType: 'blob',
      timeout: LOGS_TIMEOUT_MS,
    }),
};
