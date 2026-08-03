import {
  normalizeUsageServiceBase,
  usageServiceApi,
  usageImportSessionApi,
  type UsageApiResult,
  type UsageImportResponse,
  type UsageImportSession,
  type UsageImportSessionCreateRequest,
} from '@/services/api/usageService';

export const USAGE_IMPORT_SESSION_STORAGE_KEY = 'monitoring:usage-import-session:v1';
export const USAGE_IMPORT_SESSION_SCHEMA_VERSION = 1;
export const USAGE_IMPORT_SESSION_STORAGE_PREFIX = 'cpa-manager-plus:usage-import-session';
export const USAGE_IMPORT_SINGLE_POST_MAX_BYTES = 16 * 1024 * 1024;
export const USAGE_IMPORT_SESSION_DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024;

export type UsageImportUploadStrategy = 'single-post' | 'session';
export type UsageImportUploadPhase =
  'creating' | 'resuming' | 'uploading' | 'completing' | 'completed' | 'cancelled';

export interface UsageImportUploadDecision {
  strategy: UsageImportUploadStrategy;
  maxSinglePostBytes: number;
}

export interface UsageImportUploadProgress {
  phase: UsageImportUploadPhase;
  uploadedBytes: number;
  totalBytes: number;
  session?: UsageImportSession;
}

export interface UsageImportSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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

export interface UsageImportSessionApi {
  createUsageImportSession(
    base: string,
    payload: UsageImportSessionCreateRequest,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession>;
  getUsageImportSession(
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession>;
  uploadUsageImportSessionChunk(
    base: string,
    id: string,
    offset: number,
    payload: Blob,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession>;
  completeUsageImportSession(
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession>;
  cancelUsageImportSession(
    base: string,
    id: string,
    managementKey?: string,
    signal?: AbortSignal
  ): Promise<UsageImportSession>;
}

export interface UsageImportApi extends UsageImportSessionApi {
  importUsage(
    base: string,
    payload: Blob | string,
    managementKey?: string
  ): Promise<UsageImportResponse>;
}

export interface UploadFileInChunksOptions {
  base: string;
  file: File;
  managementKey?: string;
  signal?: AbortSignal;
  onProgress?: (progress: UsageImportUploadProgress) => void;
  api?: UsageImportSessionApi;
  storage?: UsageImportSessionStorage;
  cancelSessionOnAbort?: boolean;
}

export type UsageImportFileResult =
  | {
      strategy: 'single-post';
      result: UsageImportResponse;
    }
  | {
      strategy: 'session';
      session: UsageImportSession;
      result?: UsageImportResponse | Record<string, unknown>;
    };

export interface ImportUsageFileOptions extends Omit<UploadFileInChunksOptions, 'api'> {
  api?: UsageImportApi;
}

interface StoredUsageImportSessionFingerprint {
  sessionId: string;
  resumeKey: string;
  base: string;
  filename: string;
  sizeBytes: number;
  lastModified: number;
  updatedAtMs: number;
}

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

export class UsageImportSessionUploadError extends Error {
  session?: UsageImportSession;

  constructor(message: string, session?: UsageImportSession) {
    super(message);
    this.name = 'UsageImportSessionUploadError';
    this.session = session;
    Object.setPrototypeOf(this, UsageImportSessionUploadError.prototype);
  }
}

export class UsageImportSessionApiError extends Error {
  readonly result: Exclude<UsageApiResult<UsageImportSession>, { kind: 'success' | 'empty' }>;

  constructor(result: Exclude<UsageApiResult<UsageImportSession>, { kind: 'success' | 'empty' }>) {
    super(result.message);
    this.name = 'UsageImportSessionApiError';
    this.result = result;
  }
}

export const chooseUsageImportUploadStrategy = (
  input: Pick<Blob, 'size'> | number
): UsageImportUploadDecision => {
  const size = typeof input === 'number' ? input : input.size;
  return {
    strategy: size <= USAGE_IMPORT_SINGLE_POST_MAX_BYTES ? 'single-post' : 'session',
    maxSinglePostBytes: USAGE_IMPORT_SINGLE_POST_MAX_BYTES,
  };
};

export const buildUsageImportSessionResumeKey = (base: string, file: File): string =>
  hashToHex32(
    `${normalizeFingerprintBase(base)}\n${file.name}\n${file.size}\n${file.lastModified}`
  );

export const buildUsageImportSessionFingerprintKey = (base: string, file: File): string =>
  `${USAGE_IMPORT_SESSION_STORAGE_PREFIX}:${buildUsageImportSessionResumeKey(base, file)}`;

export const isUsageImportSessionTerminal = (session: UsageImportSession): boolean =>
  session.status === 'completed' ||
  session.status === 'cancelled' ||
  (session.status === 'failed' && !session.retryable);

export const uploadFileInChunks = async (
  options: UploadFileInChunksOptions
): Promise<UsageImportSession> => {
  const api = options.api ?? usageServiceApi;
  const storage = options.storage ?? getDefaultStorage();
  const fingerprintKey = buildUsageImportSessionFingerprintKey(options.base, options.file);
  const resumeKey = buildUsageImportSessionResumeKey(options.base, options.file);
  let session: UsageImportSession | undefined;

  try {
    throwIfAborted(options.signal);
    session = await resolveImportSession({
      ...options,
      api,
      storage,
      fingerprintKey,
      resumeKey,
    });

    let offset = normalizeReceivedBytes(session, options.file.size);
    if (isUsageImportSessionTerminal(session)) {
      clearStoredFingerprint(storage, fingerprintKey);
      emitProgress(
        options,
        session.status === 'cancelled' ? 'cancelled' : 'completed',
        offset,
        session
      );
      return requireSuccessfulSession(session);
    }
    emitProgress(options, 'uploading', offset, session);

    while (offset < options.file.size) {
      throwIfAborted(options.signal);
      if (isUsageImportSessionTerminal(session)) {
        clearStoredFingerprint(storage, fingerprintKey);
        return requireSuccessfulSession(session);
      }

      const chunkSize = normalizeChunkSize(session.chunkSizeBytes, options.file.size - offset);
      const chunkEnd = Math.min(offset + chunkSize, options.file.size);
      const chunk = options.file.slice(offset, chunkEnd);

      try {
        session = await api.uploadUsageImportSessionChunk(
          options.base,
          session.id,
          offset,
          chunk,
          options.managementKey,
          options.signal
        );
      } catch (error) {
        if (!isConflictError(error)) throw error;
        const refreshed = await api.getUsageImportSession(
          options.base,
          session.id,
          options.managementKey,
          options.signal
        );
        const receivedBytes = normalizeReceivedBytes(refreshed, options.file.size);
        if (receivedBytes === offset && refreshed.status === session.status) throw error;
        session = refreshed;
        offset = receivedBytes;
        emitProgress(options, 'uploading', offset, session);
        continue;
      }

      offset = normalizeReceivedBytes(session, options.file.size);
      writeStoredFingerprint(
        storage,
        fingerprintKey,
        options.base,
        options.file,
        resumeKey,
        session.id
      );
      emitProgress(options, 'uploading', offset, session);
    }

    throwIfAborted(options.signal);
    emitProgress(options, 'completing', options.file.size, session);
    session = await api.completeUsageImportSession(
      options.base,
      session.id,
      options.managementKey,
      options.signal
    );

    if (isUsageImportSessionTerminal(session)) {
      clearStoredFingerprint(storage, fingerprintKey);
    }
    emitProgress(
      options,
      session.status === 'cancelled' ? 'cancelled' : 'completed',
      normalizeReceivedBytes(session, options.file.size),
      session
    );
    return requireSuccessfulSession(session);
  } catch (error) {
    if (session && shouldCancelSessionOnError(error, options)) {
      await cancelSessionAfterAbort(api, options, session.id);
      clearStoredFingerprint(storage, fingerprintKey);
      emitProgress(
        options,
        'cancelled',
        normalizeReceivedBytes(session, options.file.size),
        session
      );
    }
    throw error;
  }
};

export const importUsageFile = async (
  options: ImportUsageFileOptions
): Promise<UsageImportFileResult> => {
  const api = options.api ?? usageServiceApi;
  const decision = chooseUsageImportUploadStrategy(options.file);

  if (decision.strategy === 'single-post') {
    return {
      strategy: 'single-post',
      result: await api.importUsage(options.base, options.file, options.managementKey),
    };
  }

  const session = await uploadFileInChunks({ ...options, api });
  return {
    strategy: 'session',
    session,
    result: session.result,
  };
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
  receivedBytes: clampLegacyBytes(session.receivedBytes, session.sizeBytes || fingerprint.sizeBytes),
  chunkSizeBytes: Math.max(0, Math.floor(session.chunkSizeBytes ?? 0)),
  createdAtMs: Math.max(0, Math.floor(session.createdAtMs ?? 0)),
  updatedAtMs: Math.max(0, Math.floor(session.updatedAtMs ?? 0)),
  expiresAtMs: Math.max(0, Math.floor(session.expiresAtMs ?? 0)),
});

export const loadStoredUsageImportSession = (
  storage?: UsageImportSessionStorage | null
): StoredUsageImportSession | null => {
  const resolved = resolveLegacyStorage(storage);
  if (!resolved) return null;

  try {
    const raw = resolved.getItem(USAGE_IMPORT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const schemaVersion = readLegacyNumber(parsed.schemaVersion);
    const fingerprint = readLegacyString(parsed.fingerprint);
    const filename = readLegacyString(parsed.filename);
    const sizeBytes = readLegacyNumber(parsed.sizeBytes);
    const lastModifiedMs = readLegacyNumber(parsed.lastModifiedMs);
    const sessionId = readLegacyString(parsed.sessionId);
    const status = readLegacyString(parsed.status);
    const receivedBytes = readLegacyNumber(parsed.receivedBytes);
    const chunkSizeBytes = readLegacyNumber(parsed.chunkSizeBytes);
    const createdAtMs = readLegacyNumber(parsed.createdAtMs);
    const updatedAtMs = readLegacyNumber(parsed.updatedAtMs);
    const expiresAtMs = readLegacyNumber(parsed.expiresAtMs);
    const mediaType = readLegacyString(parsed.mediaType);

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
  const resolved = resolveLegacyStorage(storage);
  if (!resolved) return null;
  const stored = toStoredUsageImportSession(session, fingerprint);
  resolved.setItem(USAGE_IMPORT_SESSION_STORAGE_KEY, JSON.stringify(stored));
  return stored;
};

export const clearStoredUsageImportSession = (
  storage?: UsageImportSessionStorage | null
): void => {
  resolveLegacyStorage(storage)?.removeItem(USAGE_IMPORT_SESSION_STORAGE_KEY);
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
  if ((session.expiresAtMs ?? 0) > 0 && session.expiresAtMs <= nowMs) {
    return { state: 'restart_required', reason: 'expired', session, stored: stored ?? undefined };
  }
  if (LEGACY_ACTIVE_IMPORT_STATUSES.has(session.status)) {
    return session.retryable
      ? { state: 'recoverable', reason: 'active', session, stored: stored ?? undefined }
      : { state: 'restart_required', reason: 'not_retryable', session, stored: stored ?? undefined };
  }
  if (session.status === 'failed') {
    return session.retryable
      ? { state: 'recoverable', reason: 'retryable', session, stored: stored ?? undefined }
      : { state: 'restart_required', reason: 'failed', session, stored: stored ?? undefined };
  }
  if (LEGACY_TERMINAL_IMPORT_STATUSES.has(session.status)) {
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
  return Math.round((clampLegacyBytes(session.receivedBytes, session.sizeBytes) / session.sizeBytes) * 100);
};

export const selectUsageImportOffset = (
  session: Pick<UsageImportSession, 'receivedBytes' | 'sizeBytes'>
): number => clampLegacyBytes(session.receivedBytes, session.sizeBytes);

export const selectNextUsageImportChunk = (
  file: UsageImportFileLike,
  session: Pick<UsageImportSession, 'receivedBytes' | 'sizeBytes' | 'chunkSizeBytes'>
): UsageImportChunkSelection | null => {
  const offset = clampLegacyBytes(session.receivedBytes, file.size);
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
    if (isMissingLegacySessionResult(result)) {
      return { state: 'restart_required', reason: 'no_session', stored };
    }
    const session = unwrapLegacyUsageImportSession(result);
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
    if (isMissingLegacySessionResult(recoveredResult)) {
      clearStoredUsageImportSession(storage);
    } else {
      const recovered = unwrapLegacyUsageImportSession(recoveredResult);
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
    session = unwrapLegacyUsageImportSession(
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
      await delayLegacyUsageImport(pollDelayMs, signal);
      session = unwrapLegacyUsageImportSession(await api.get(session.id, signal));
      continue;
    }

    const chunk = selectNextUsageImportChunk(file, session);
    if (chunk) {
      session = unwrapLegacyUsageImportSession(
        await api.uploadChunk(session.id, chunk.offset, chunk.payload, signal)
      );
      continue;
    }

    session = unwrapLegacyUsageImportSession(await api.complete(session.id, signal));
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
  const session = unwrapLegacyUsageImportSession(
    await (options.api ?? usageImportSessionApi).cancel(sessionId, options.signal)
  );
  clearStoredUsageImportSession(options.storage);
  return session;
};

const LEGACY_ACTIVE_IMPORT_STATUSES = new Set(['uploading', 'ready', 'processing']);
const LEGACY_TERMINAL_IMPORT_STATUSES = new Set(['completed', 'cancelled']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readLegacyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
};

const readLegacyNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const clampLegacyBytes = (value: number, max: number): number =>
  Math.max(0, Math.min(Math.floor(value), Math.max(0, Math.floor(max))));

const hashFingerprintSeed = (seed: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const unwrapLegacyUsageImportSession = (
  result: UsageApiResult<UsageImportSession>
): UsageImportSession => {
  if (result.kind === 'success' || result.kind === 'empty') return result.data;
  throw new UsageImportSessionApiError(result);
};

const isMissingLegacySessionResult = (result: UsageApiResult<UsageImportSession>): boolean =>
  result.kind === 'error' && (result.status === 404 || result.status === 410);

const delayLegacyUsageImport = (ms: number, signal?: AbortSignal): Promise<void> => {
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

const resolveLegacyStorage = (
  storage: UsageImportSessionStorage | null | undefined
): UsageImportSessionStorage | null => {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const resolveImportSession = async (
  options: UploadFileInChunksOptions & {
    api: UsageImportSessionApi;
    storage?: UsageImportSessionStorage;
    fingerprintKey: string;
    resumeKey: string;
  }
): Promise<UsageImportSession> => {
  const stored = readStoredFingerprint(options.storage, options.fingerprintKey);
  if (stored?.sessionId && stored.resumeKey === options.resumeKey) {
    try {
      const session = await options.api.getUsageImportSession(
        options.base,
        stored.sessionId,
        options.managementKey,
        options.signal
      );
      if (!isUsageImportSessionTerminal(session)) {
        emitProgress(
          options,
          'resuming',
          normalizeReceivedBytes(session, options.file.size),
          session
        );
        return session;
      }
      clearStoredFingerprint(options.storage, options.fingerprintKey);
      return session;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      clearStoredFingerprint(options.storage, options.fingerprintKey);
    }
  }

  emitProgress(options, 'creating', 0);
  const session = await options.api.createUsageImportSession(
    options.base,
    {
      filename: options.file.name,
      size_bytes: options.file.size,
      resume_key: options.resumeKey,
    },
    options.managementKey,
    options.signal
  );
  writeStoredFingerprint(
    options.storage,
    options.fingerprintKey,
    options.base,
    options.file,
    options.resumeKey,
    session.id
  );
  return session;
};

const requireSuccessfulSession = (session: UsageImportSession): UsageImportSession => {
  if (session.status === 'failed' || session.status === 'cancelled') {
    throw new UsageImportSessionUploadError(
      session.error || `Usage import session ${session.status}`,
      session
    );
  }
  return session;
};

const normalizeChunkSize = (chunkSizeBytes: number, remainingBytes: number): number => {
  const chunkSize =
    Number.isFinite(chunkSizeBytes) && chunkSizeBytes > 0
      ? Math.floor(chunkSizeBytes)
      : USAGE_IMPORT_SESSION_DEFAULT_CHUNK_BYTES;
  return Math.max(1, Math.min(chunkSize, remainingBytes));
};

const normalizeReceivedBytes = (session: UsageImportSession, totalBytes: number): number => {
  if (!Number.isFinite(session.receivedBytes)) return 0;
  return Math.max(0, Math.min(Math.floor(session.receivedBytes), totalBytes));
};

const emitProgress = (
  options: Pick<UploadFileInChunksOptions, 'file' | 'onProgress'>,
  phase: UsageImportUploadPhase,
  uploadedBytes: number,
  session?: UsageImportSession
) => {
  options.onProgress?.({
    phase,
    uploadedBytes,
    totalBytes: options.file.size,
    session,
  });
};

const shouldCancelSessionOnError = (
  error: unknown,
  options: Pick<UploadFileInChunksOptions, 'signal' | 'cancelSessionOnAbort'>
): boolean => options.cancelSessionOnAbort !== false && isAbortLikeError(error, options.signal);

const cancelSessionAfterAbort = async (
  api: UsageImportSessionApi,
  options: Pick<UploadFileInChunksOptions, 'base' | 'managementKey'>,
  sessionId: string
) => {
  try {
    await api.cancelUsageImportSession(options.base, sessionId, options.managementKey);
  } catch {
    // The local abort path must preserve the original cancellation reason.
  }
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  const error = new Error('Usage import upload aborted');
  error.name = 'AbortError';
  throw error;
};

const isAbortLikeError = (error: unknown, signal?: AbortSignal): boolean => {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'CanceledError';
};

const isConflictError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: unknown }).status === 409;

const isNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: unknown }).status === 404;

const getDefaultStorage = (): UsageImportSessionStorage | undefined => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return undefined;
};

const readStoredFingerprint = (
  storage: UsageImportSessionStorage | undefined,
  key: string
): StoredUsageImportSessionFingerprint | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUsageImportSessionFingerprint>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.resumeKey !== 'string' ||
      typeof parsed.filename !== 'string' ||
      typeof parsed.sizeBytes !== 'number' ||
      typeof parsed.lastModified !== 'number'
    ) {
      return null;
    }
    return parsed as StoredUsageImportSessionFingerprint;
  } catch {
    return null;
  }
};

const writeStoredFingerprint = (
  storage: UsageImportSessionStorage | undefined,
  key: string,
  base: string,
  file: File,
  resumeKey: string,
  sessionId: string
) => {
  if (!storage) return;
  const value: StoredUsageImportSessionFingerprint = {
    sessionId,
    resumeKey,
    base: normalizeFingerprintBase(base),
    filename: file.name,
    sizeBytes: file.size,
    lastModified: file.lastModified,
    updatedAtMs: Date.now(),
  };
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failure should not block an otherwise valid upload.
  }
};

const clearStoredFingerprint = (storage: UsageImportSessionStorage | undefined, key: string) => {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const normalizeFingerprintBase = (base: string): string =>
  normalizeUsageServiceBase(base).replace(/\/+$/, '');

const hashToHex32 = (value: string): string => {
  const seeds = [0x811c9dc5, 0x12345678, 0x87654321, 0xfeedcafe];
  return seeds.map((seed) => fnv1aHex(value, seed)).join('');
};

const fnv1aHex = (value: string, seed: number): string => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};
