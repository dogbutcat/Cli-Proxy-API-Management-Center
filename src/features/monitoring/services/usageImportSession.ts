import {
  usageImportSessionApi,
  type UsageApiResult,
  type UsageImportSession,
  type UsageImportSessionCreateRequest,
} from '@/services/api/usageService';

export const USAGE_IMPORT_SESSION_STORAGE_KEY = 'monitoring:usage-import-session:v1';
export const USAGE_IMPORT_SESSION_SCHEMA_VERSION = 1;

export type UsageImportFileLike = {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
  slice: (start?: number, end?: number, contentType?: string) => Blob;
};

export type UsageImportSessionApiLike = {
  create: (
    request: UsageImportSessionCreateRequest,
    signal?: AbortSignal
  ) => Promise<UsageApiResult<UsageImportSession>>;
  get: (id: string, signal?: AbortSignal) => Promise<UsageApiResult<UsageImportSession>>;
  uploadChunk: (
    id: string,
    offset: number,
    payload: Blob,
    signal?: AbortSignal
  ) => Promise<UsageApiResult<UsageImportSession>>;
  complete: (id: string, signal?: AbortSignal) => Promise<UsageApiResult<UsageImportSession>>;
  cancel: (id: string, signal?: AbortSignal) => Promise<UsageApiResult<UsageImportSession>>;
};

export type UsageImportSessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type UsageImportFileFingerprint = {
  fingerprint: string;
  filename: string;
  sizeBytes: number;
  lastModifiedMs: number;
  mediaType?: string;
};

export type StoredUsageImportSession = UsageImportFileFingerprint & {
  schemaVersion: typeof USAGE_IMPORT_SESSION_SCHEMA_VERSION;
  sessionId: string;
  status: string;
  receivedBytes: number;
  chunkSizeBytes: number;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
};

export type UsageImportRecoveryState =
  | 'none'
  | 'recoverable'
  | 'completed'
  | 'restart_required';

export type UsageImportRecoveryReason =
  | 'no_session'
  | 'file_mismatch'
  | 'active'
  | 'retryable'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'expired'
  | 'not_retryable';

export type UsageImportRecovery = {
  state: UsageImportRecoveryState;
  reason: UsageImportRecoveryReason;
  session?: UsageImportSession;
  stored?: StoredUsageImportSession;
};

export type UsageImportChunkSelection = {
  offset: number;
  end: number;
  sizeBytes: number;
  payload: Blob;
};

export type UsageImportSessionProgress = {
  session: UsageImportSession;
  percent: number;
  recovery: UsageImportRecovery;
};

export type RunUsageImportSessionUploadOptions = {
  file: UsageImportFileLike;
  api?: UsageImportSessionApiLike;
  storage?: UsageImportSessionStorage | null;
  signal?: AbortSignal;
  nowMs?: () => number;
  pollDelayMs?: number;
  maxProcessingPolls?: number;
  onProgress?: (progress: UsageImportSessionProgress) => void;
};

export class UsageImportSessionApiError extends Error {
  readonly result: Exclude<UsageApiResult<UsageImportSession>, { kind: 'success' | 'empty' }>;

  constructor(result: Exclude<UsageApiResult<UsageImportSession>, { kind: 'success' | 'empty' }>) {
    super(result.message);
    this.name = 'UsageImportSessionApiError';
    this.result = result;
  }
}

const ACTIVE_STATUSES = new Set(['uploading', 'ready', 'processing']);
const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
};

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const clampBytes = (value: number, max: number): number =>
  Math.max(0, Math.min(Math.floor(value), Math.max(0, Math.floor(max))));

const hashFingerprintSeed = (seed: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const resolveStorage = (
  storage: UsageImportSessionStorage | null | undefined
): UsageImportSessionStorage | null => {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const unwrapUsageImportSession = (
  result: UsageApiResult<UsageImportSession>
): UsageImportSession => {
  if (result.kind === 'success' || result.kind === 'empty') return result.data;
  throw new UsageImportSessionApiError(result);
};

const isMissingSessionResult = (result: UsageApiResult<UsageImportSession>): boolean =>
  result.kind === 'error' && (result.status === 404 || result.status === 410);

const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
};

export const createUsageImportFileFingerprint = (
  file: UsageImportFileLike
): UsageImportFileFingerprint => {
  const filename = file.name.trim() || 'usage-import';
  const sizeBytes = Math.max(0, Math.floor(file.size));
  const lastModifiedMs = Math.max(0, Math.floor(file.lastModified ?? 0));
  const mediaType = file.type?.trim() || undefined;
  const seed = [filename, sizeBytes, lastModifiedMs, mediaType ?? ''].join('\u001f');
  return {
    fingerprint: `usage-import-v1-${hashFingerprintSeed(seed)}`,
    filename,
    sizeBytes,
    lastModifiedMs,
    mediaType,
  };
};

export const doesStoredSessionMatchFile = (
  stored: StoredUsageImportSession | null,
  fingerprint: UsageImportFileFingerprint
): stored is StoredUsageImportSession =>
  Boolean(
    stored &&
      stored.fingerprint === fingerprint.fingerprint &&
      stored.filename === fingerprint.filename &&
      stored.sizeBytes === fingerprint.sizeBytes &&
      stored.lastModifiedMs === fingerprint.lastModifiedMs &&
      stored.mediaType === fingerprint.mediaType
  );

export const toStoredUsageImportSession = (
  session: UsageImportSession,
  fingerprint: UsageImportFileFingerprint
): StoredUsageImportSession => ({
  schemaVersion: USAGE_IMPORT_SESSION_SCHEMA_VERSION,
  fingerprint: fingerprint.fingerprint,
  filename: fingerprint.filename,
  sizeBytes: fingerprint.sizeBytes,
  lastModifiedMs: fingerprint.lastModifiedMs,
  mediaType: fingerprint.mediaType,
  sessionId: session.id,
  status: session.status,
  receivedBytes: clampBytes(session.receivedBytes, session.sizeBytes || fingerprint.sizeBytes),
  chunkSizeBytes: Math.max(0, Math.floor(session.chunkSizeBytes)),
  createdAtMs: Math.max(0, Math.floor(session.createdAtMs)),
  updatedAtMs: Math.max(0, Math.floor(session.updatedAtMs)),
  expiresAtMs: Math.max(0, Math.floor(session.expiresAtMs)),
});

export const loadStoredUsageImportSession = (
  storage?: UsageImportSessionStorage | null
): StoredUsageImportSession | null => {
  const resolved = resolveStorage(storage);
  if (!resolved) return null;

  try {
    const raw = resolved.getItem(USAGE_IMPORT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const schemaVersion = readNumber(parsed.schemaVersion);
    const fingerprint = readString(parsed.fingerprint);
    const filename = readString(parsed.filename);
    const sizeBytes = readNumber(parsed.sizeBytes);
    const lastModifiedMs = readNumber(parsed.lastModifiedMs);
    const sessionId = readString(parsed.sessionId);
    const status = readString(parsed.status);
    const receivedBytes = readNumber(parsed.receivedBytes);
    const chunkSizeBytes = readNumber(parsed.chunkSizeBytes);
    const createdAtMs = readNumber(parsed.createdAtMs);
    const updatedAtMs = readNumber(parsed.updatedAtMs);
    const expiresAtMs = readNumber(parsed.expiresAtMs);
    const mediaType = readString(parsed.mediaType);

    if (
      schemaVersion !== USAGE_IMPORT_SESSION_SCHEMA_VERSION ||
      !fingerprint ||
      !filename ||
      sizeBytes === undefined ||
      lastModifiedMs === undefined ||
      !sessionId ||
      !status ||
      receivedBytes === undefined ||
      chunkSizeBytes === undefined ||
      createdAtMs === undefined ||
      updatedAtMs === undefined ||
      expiresAtMs === undefined
    ) {
      return null;
    }

    return {
      schemaVersion: USAGE_IMPORT_SESSION_SCHEMA_VERSION,
      fingerprint,
      filename,
      sizeBytes,
      lastModifiedMs,
      mediaType,
      sessionId,
      status,
      receivedBytes,
      chunkSizeBytes,
      createdAtMs,
      updatedAtMs,
      expiresAtMs,
    };
  } catch {
    return null;
  }
};

export const saveStoredUsageImportSession = (
  storage: UsageImportSessionStorage | null | undefined,
  session: UsageImportSession,
  fingerprint: UsageImportFileFingerprint
): StoredUsageImportSession | null => {
  const resolved = resolveStorage(storage);
  if (!resolved) return null;
  const stored = toStoredUsageImportSession(session, fingerprint);
  resolved.setItem(USAGE_IMPORT_SESSION_STORAGE_KEY, JSON.stringify(stored));
  return stored;
};

export const clearStoredUsageImportSession = (
  storage?: UsageImportSessionStorage | null
): void => {
  const resolved = resolveStorage(storage);
  resolved?.removeItem(USAGE_IMPORT_SESSION_STORAGE_KEY);
};

export const classifyUsageImportRecovery = (
  session: UsageImportSession | null | undefined,
  stored: StoredUsageImportSession | null,
  fingerprint?: UsageImportFileFingerprint,
  nowMs = Date.now()
): UsageImportRecovery => {
  if (!session && !stored) return { state: 'none', reason: 'no_session' };
  if (stored && fingerprint && !doesStoredSessionMatchFile(stored, fingerprint)) {
    return { state: 'restart_required', reason: 'file_mismatch', session: session ?? undefined, stored };
  }
  if (!session) return { state: 'recoverable', reason: 'retryable', stored: stored ?? undefined };
  if (session.status === 'completed') {
    return { state: 'completed', reason: 'completed', session, stored: stored ?? undefined };
  }
  if (session.expiresAtMs > 0 && session.expiresAtMs <= nowMs) {
    return { state: 'restart_required', reason: 'expired', session, stored: stored ?? undefined };
  }
  if (ACTIVE_STATUSES.has(session.status)) {
    return session.retryable
      ? { state: 'recoverable', reason: 'active', session, stored: stored ?? undefined }
      : { state: 'restart_required', reason: 'not_retryable', session, stored: stored ?? undefined };
  }
  if (session.status === 'failed') {
    return session.retryable
      ? { state: 'recoverable', reason: 'retryable', session, stored: stored ?? undefined }
      : { state: 'restart_required', reason: 'failed', session, stored: stored ?? undefined };
  }
  if (TERMINAL_STATUSES.has(session.status)) {
    return { state: 'restart_required', reason: 'cancelled', session, stored: stored ?? undefined };
  }
  return session.retryable
    ? { state: 'recoverable', reason: 'retryable', session, stored: stored ?? undefined }
    : { state: 'restart_required', reason: 'not_retryable', session, stored: stored ?? undefined };
};

export const getUsageImportProgressPercent = (
  session: Pick<UsageImportSession, 'receivedBytes' | 'sizeBytes' | 'status'>
): number => {
  if (session.status === 'completed') return 100;
  if (session.sizeBytes <= 0) return 0;
  return Math.round((clampBytes(session.receivedBytes, session.sizeBytes) / session.sizeBytes) * 100);
};

export const selectUsageImportOffset = (
  session: Pick<UsageImportSession, 'receivedBytes' | 'sizeBytes'>
): number => clampBytes(session.receivedBytes, session.sizeBytes);

export const selectNextUsageImportChunk = (
  file: UsageImportFileLike,
  session: Pick<UsageImportSession, 'receivedBytes' | 'sizeBytes' | 'chunkSizeBytes'>
): UsageImportChunkSelection | null => {
  const offset = clampBytes(session.receivedBytes, file.size);
  if (offset >= file.size) return null;

  const chunkSizeBytes =
    session.chunkSizeBytes > 0 ? Math.floor(session.chunkSizeBytes) : Math.max(1, file.size - offset);
  const end = Math.min(file.size, offset + chunkSizeBytes);
  return {
    offset,
    end,
    sizeBytes: end - offset,
    payload: file.slice(offset, end, file.type),
  };
};

export const recoverUsageImportSession = async ({
  file,
  api = usageImportSessionApi,
  storage,
  signal,
  nowMs = Date.now,
}: Pick<RunUsageImportSessionUploadOptions, 'file' | 'api' | 'storage' | 'signal' | 'nowMs'>): Promise<UsageImportRecovery> => {
  const fingerprint = createUsageImportFileFingerprint(file);
  const stored = loadStoredUsageImportSession(storage);
  if (!doesStoredSessionMatchFile(stored, fingerprint)) {
    return classifyUsageImportRecovery(null, stored, fingerprint, nowMs());
  }

  try {
    const result = await api.get(stored.sessionId, signal);
    if (isMissingSessionResult(result)) {
      return { state: 'restart_required', reason: 'no_session', stored };
    }
    const session = unwrapUsageImportSession(result);
    return classifyUsageImportRecovery(session, stored, fingerprint, nowMs());
  } catch {
    return classifyUsageImportRecovery(null, stored, fingerprint, nowMs());
  }
};

export const runUsageImportSessionUpload = async ({
  file,
  api = usageImportSessionApi,
  storage,
  signal,
  nowMs = Date.now,
  pollDelayMs = 500,
  maxProcessingPolls = 20,
  onProgress,
}: RunUsageImportSessionUploadOptions): Promise<UsageImportSession> => {
  const fingerprint = createUsageImportFileFingerprint(file);
  const stored = loadStoredUsageImportSession(storage);
  let session: UsageImportSession | null = null;

  if (doesStoredSessionMatchFile(stored, fingerprint)) {
    const recoveredResult = await api.get(stored.sessionId, signal);
    if (isMissingSessionResult(recoveredResult)) {
      clearStoredUsageImportSession(storage);
    } else {
      const recovered = unwrapUsageImportSession(recoveredResult);
      const recovery = classifyUsageImportRecovery(recovered, stored, fingerprint, nowMs());
      if (recovery.state === 'recoverable') session = recovered;
      if (recovery.state === 'completed') {
        clearStoredUsageImportSession(storage);
        return recovered;
      }
      if (recovery.state === 'restart_required') clearStoredUsageImportSession(storage);
    }
  } else if (stored) {
    clearStoredUsageImportSession(storage);
  }

  if (!session) {
    session = unwrapUsageImportSession(
      await api.create(
        {
          filename: fingerprint.filename,
          sizeBytes: fingerprint.sizeBytes,
          resumeKey: fingerprint.fingerprint,
        },
        signal
      )
    );
  }

  let processingPolls = 0;
  while (true) {
    const storedSession = saveStoredUsageImportSession(storage, session, fingerprint);
    onProgress?.({
      session,
      percent: getUsageImportProgressPercent(session),
      recovery: classifyUsageImportRecovery(session, storedSession, fingerprint, nowMs()),
    });

    if (session.status === 'completed') {
      clearStoredUsageImportSession(storage);
      return session;
    }
    if (session.status === 'cancelled' || (session.status === 'failed' && !session.retryable)) {
      return session;
    }
    if (session.status === 'processing') {
      if (processingPolls >= maxProcessingPolls) return session;
      processingPolls += 1;
      await delay(pollDelayMs, signal);
      session = unwrapUsageImportSession(await api.get(session.id, signal));
      continue;
    }

    const chunk = selectNextUsageImportChunk(file, session);
    if (chunk) {
      session = unwrapUsageImportSession(
        await api.uploadChunk(session.id, chunk.offset, chunk.payload, signal)
      );
      continue;
    }

    session = unwrapUsageImportSession(await api.complete(session.id, signal));
  }
};

export const cancelUsageImportSession = async (
  sessionId: string,
  options: {
    api?: UsageImportSessionApiLike;
    storage?: UsageImportSessionStorage | null;
    signal?: AbortSignal;
  } = {}
): Promise<UsageImportSession> => {
  const session = unwrapUsageImportSession(
    await (options.api ?? usageImportSessionApi).cancel(sessionId, options.signal)
  );
  clearStoredUsageImportSession(options.storage);
  return session;
};
