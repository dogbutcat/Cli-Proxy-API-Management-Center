export type RecordLike = Record<string, unknown>;

export const isMonitoringRecord = (value: unknown): value is RecordLike =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const readMonitoringString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const parseMonitoringBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
};

export const extractMonitoringArrayPayload = (payload: unknown, key: string): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isMonitoringRecord(payload)) return [];
  const candidate = payload[key] ?? payload.items ?? payload.data;
  return Array.isArray(candidate) ? candidate : [];
};

export const extractMonitoringHost = (baseUrl: string): string => {
  const trimmed = readMonitoringString(baseUrl);
  if (!trimmed) return '-';

  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split('/')[0] || trimmed;
  }
};

export const joinMonitoringUnique = (values: Iterable<string>, limit = 3): string => {
  const unique = Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (unique.length <= limit) return unique.join(', ');
  return `${unique.slice(0, limit).join(', ')} +${unique.length - limit}`;
};

export const maskMonitoringEmail = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^([^@\s]{1,3})[^@\s]*@(.+)$/);
  if (!match) return trimmed;
  return `${match[1]}***@${match[2]}`;
};

export const maskMonitoringToken = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return '-';
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

export const buildMonitoringSearchText = (
  ...parts: Array<string | number | boolean | null | undefined>
): string =>
  parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim().toLowerCase()))
    .filter(Boolean)
    .join(' ');
