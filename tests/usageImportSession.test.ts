import { describe, expect, test } from 'bun:test';
import {
  assertUsageImportSessionRedacted,
  normalizeUsageImportSession,
  serializeUsageImportSessionCreateRequest,
  type UsageApiResult,
  type UsageImportSession,
  type WireUsageImportSession,
} from '../src/services/api/usageService';
import {
  USAGE_IMPORT_SESSION_STORAGE_KEY,
  cancelUsageImportSession,
  classifyUsageImportRecovery,
  clearStoredUsageImportSession,
  createUsageImportFileFingerprint,
  getUsageImportProgressPercent,
  loadStoredUsageImportSession,
  recoverUsageImportSession,
  runUsageImportSessionUpload,
  saveStoredUsageImportSession,
  selectNextUsageImportChunk,
  selectUsageImportOffset,
  type UsageImportSessionApiLike,
} from '../src/features/monitoring/services/usageImportSession';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const success = (data: UsageImportSession): UsageApiResult<UsageImportSession> => ({
  kind: 'success',
  data,
});

const sessionFixture = (
  overrides: Partial<UsageImportSession> = {}
): UsageImportSession => ({
  id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  filename: 'usage.jsonl',
  status: 'uploading',
  sizeBytes: 12,
  receivedBytes: 0,
  chunkSizeBytes: 5,
  createdAtMs: 1,
  updatedAtMs: 1,
  expiresAtMs: 10_000,
  retryable: true,
  ...overrides,
});

const makeFile = (body = 'abcdefghijkl'): File =>
  new File([body], 'usage.jsonl', {
    type: 'application/jsonl',
    lastModified: 99,
  });

describe('usage import session DTO contract', () => {
  test('serializes create request with frozen snake_case transport fields', () => {
    expect(
      serializeUsageImportSessionCreateRequest({
        filename: '../usage.jsonl',
        sizeBytes: 123,
        resumeKey: 'resume-a',
      })
    ).toEqual({
      filename: '../usage.jsonl',
      size_bytes: 123,
      resume_key: 'resume-a',
    });
  });

  test('normalizes session response into canonical camelCase model', () => {
    expect(
      normalizeUsageImportSession({
        id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        filename: 'usage.jsonl',
        status: 'uploading',
        size_bytes: 123,
        received_bytes: 10,
        chunk_size_bytes: 4,
        created_at_ms: 1,
        updated_at_ms: 2,
        expires_at_ms: 3,
        retryable: true,
      })
    ).toEqual({
      id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      filename: 'usage.jsonl',
      status: 'uploading',
      sizeBytes: 123,
      receivedBytes: 10,
      chunkSizeBytes: 4,
      createdAtMs: 1,
      updatedAtMs: 2,
      expiresAtMs: 3,
      retryable: true,
      error: undefined,
      result: undefined,
    });
  });

  test('accepts legacy camelCase fields without leaking wire aliases upstream', () => {
    expect(
      normalizeUsageImportSession({
        id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        filename: 'usage.jsonl',
        status: 'completed',
        sizeBytes: 5,
        receivedBytes: 5,
        chunkSizeBytes: 1024,
        createdAtMs: 1,
        updatedAtMs: 2,
        expiresAtMs: 3,
        retryable: false,
        result: {
          format: 'jsonl',
          added: 1,
          skipped: 0,
          total: 1,
          failed: 0,
          warnings: ['ignored row'],
        },
      })
    ).toEqual({
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      filename: 'usage.jsonl',
      status: 'completed',
      sizeBytes: 5,
      receivedBytes: 5,
      chunkSizeBytes: 1024,
      createdAtMs: 1,
      updatedAtMs: 2,
      expiresAtMs: 3,
      retryable: false,
      error: undefined,
      result: {
        format: 'jsonl',
        added: 1,
        skipped: 0,
        total: 1,
        failed: 0,
        unsupported: undefined,
        warnings: ['ignored row'],
      },
    });
  });

  test('redaction guard rejects resume keys in response DTOs', () => {
    const safe: WireUsageImportSession = {
      id: 'cccccccccccccccccccccccccccccccc',
      filename: 'usage.jsonl',
      status: 'uploading',
    };
    expect(() => assertUsageImportSessionRedacted(safe)).not.toThrow();
    expect(() =>
      assertUsageImportSessionRedacted({
        ...safe,
        resume_key: 'resume-a',
      })
    ).toThrow('resume keys');
  });
});

describe('usage import session monitoring helpers', () => {
  test('builds deterministic non-content fingerprint metadata', () => {
    const first = createUsageImportFileFingerprint(makeFile('first-body'));
    const second = createUsageImportFileFingerprint(makeFile('secondbody'));

    expect(first).toEqual(second);
    expect(first).toEqual({
      fingerprint: first.fingerprint,
      filename: 'usage.jsonl',
      sizeBytes: 10,
      lastModifiedMs: 99,
      mediaType: 'application/jsonl',
    });
    expect(first.fingerprint).toStartWith('usage-import-v1-');
  });

  test('persists only resumable metadata in localStorage', () => {
    const storage = new MemoryStorage();
    const fingerprint = createUsageImportFileFingerprint(makeFile());
    const stored = saveStoredUsageImportSession(storage, sessionFixture({ receivedBytes: 5 }), fingerprint);
    const raw = storage.getItem(USAGE_IMPORT_SESSION_STORAGE_KEY);

    expect(stored?.sessionId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(loadStoredUsageImportSession(storage)).toEqual(stored);
    expect(raw).toBeString();
    expect(raw).not.toContain('resume_key');
    expect(raw).not.toContain('resumeKey');
    expect(raw).not.toContain('abcdefghijkl');

    clearStoredUsageImportSession(storage);
    expect(loadStoredUsageImportSession(storage)).toBeNull();
  });

  test('classifies retryable, expired, non-retryable, and completed recovery states', () => {
    const storage = new MemoryStorage();
    const fingerprint = createUsageImportFileFingerprint(makeFile());
    const stored = saveStoredUsageImportSession(storage, sessionFixture(), fingerprint);

    expect(
      classifyUsageImportRecovery(sessionFixture({ status: 'failed', retryable: true }), stored, fingerprint, 2)
    ).toMatchObject({ state: 'recoverable', reason: 'retryable' });
    expect(
      classifyUsageImportRecovery(sessionFixture({ status: 'uploading', expiresAtMs: 1 }), stored, fingerprint, 2)
    ).toMatchObject({ state: 'restart_required', reason: 'expired' });
    expect(
      classifyUsageImportRecovery(sessionFixture({ status: 'uploading', retryable: false }), stored, fingerprint, 2)
    ).toMatchObject({ state: 'restart_required', reason: 'not_retryable' });
    expect(
      classifyUsageImportRecovery(sessionFixture({ status: 'completed' }), stored, fingerprint, 2)
    ).toMatchObject({ state: 'completed', reason: 'completed' });
  });

  test('selects next chunk from server offset and clamps progress', async () => {
    const file = makeFile();
    const session = sessionFixture({ receivedBytes: 5, chunkSizeBytes: 4 });
    const chunk = selectNextUsageImportChunk(file, session);

    expect(selectUsageImportOffset(session)).toBe(5);
    expect(getUsageImportProgressPercent(session)).toBe(42);
    expect(chunk?.offset).toBe(5);
    expect(chunk?.end).toBe(9);
    expect(chunk?.sizeBytes).toBe(4);
    expect(await chunk?.payload.text()).toBe('fghi');
    expect(getUsageImportProgressPercent(sessionFixture({ receivedBytes: 15 }))).toBe(100);
  });

  test('uploads chunks, completes, reports progress, and clears local recovery state', async () => {
    const storage = new MemoryStorage();
    const calls: Array<{ offset: number; text: string }> = [];
    const progress: number[] = [];
    let current = sessionFixture();
    const api: UsageImportSessionApiLike = {
      create: async (request) => {
        expect(request).toMatchObject({
          filename: 'usage.jsonl',
          sizeBytes: 12,
        });
        expect(request.resumeKey).toStartWith('usage-import-v1-');
        return success(current);
      },
      get: async () => success(current),
      uploadChunk: async (_id, offset, payload) => {
        calls.push({ offset, text: await payload.text() });
        current = sessionFixture({
          receivedBytes: Math.min(12, offset + payload.size),
          status: offset + payload.size >= 12 ? 'ready' : 'uploading',
        });
        return success(current);
      },
      complete: async () => {
        current = sessionFixture({
          status: 'completed',
          receivedBytes: 12,
          result: { added: 2, skipped: 0, total: 2, failed: 0 },
        });
        return success(current);
      },
      cancel: async () => success(sessionFixture({ status: 'cancelled' })),
    };

    const result = await runUsageImportSessionUpload({
      file: makeFile(),
      api,
      storage,
      pollDelayMs: 0,
      onProgress: ({ percent }) => progress.push(percent),
    });

    expect(result.status).toBe('completed');
    expect(calls).toEqual([
      { offset: 0, text: 'abcde' },
      { offset: 5, text: 'fghij' },
      { offset: 10, text: 'kl' },
    ]);
    expect(progress).toEqual([0, 42, 83, 100, 100]);
    expect(loadStoredUsageImportSession(storage)).toBeNull();
  });

  test('recovers matching stored session before uploading remaining chunks', async () => {
    const storage = new MemoryStorage();
    const fingerprint = createUsageImportFileFingerprint(makeFile());
    saveStoredUsageImportSession(storage, sessionFixture({ receivedBytes: 5 }), fingerprint);
    let current = sessionFixture({ receivedBytes: 5 });
    const offsets: number[] = [];
    const api: UsageImportSessionApiLike = {
      create: async () => {
        throw new Error('create should not be called for recoverable sessions');
      },
      get: async () => success(current),
      uploadChunk: async (_id, offset, payload) => {
        offsets.push(offset);
        current = sessionFixture({
          receivedBytes: Math.min(12, offset + payload.size),
          status: offset + payload.size >= 12 ? 'ready' : 'uploading',
        });
        return success(current);
      },
      complete: async () => {
        current = sessionFixture({ status: 'completed', receivedBytes: 12 });
        return success(current);
      },
      cancel: async () => success(sessionFixture({ status: 'cancelled' })),
    };

    expect(await recoverUsageImportSession({ file: makeFile(), api, storage, nowMs: () => 2 })).toMatchObject({
      state: 'recoverable',
      reason: 'active',
    });
    const result = await runUsageImportSessionUpload({
      file: makeFile(),
      api,
      storage,
      nowMs: () => 2,
      pollDelayMs: 0,
    });

    expect(result.status).toBe('completed');
    expect(offsets).toEqual([5, 10]);
  });

  test('cancel calls backend and clears local state', async () => {
    const storage = new MemoryStorage();
    const fingerprint = createUsageImportFileFingerprint(makeFile());
    saveStoredUsageImportSession(storage, sessionFixture({ receivedBytes: 5 }), fingerprint);
    let cancelledId = '';
    const api: UsageImportSessionApiLike = {
      create: async () => success(sessionFixture()),
      get: async () => success(sessionFixture()),
      uploadChunk: async () => success(sessionFixture()),
      complete: async () => success(sessionFixture({ status: 'completed' })),
      cancel: async (id) => {
        cancelledId = id;
        return success(sessionFixture({ id, status: 'cancelled' }));
      },
    };

    const result = await cancelUsageImportSession('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { api, storage });

    expect(cancelledId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.status).toBe('cancelled');
    expect(loadStoredUsageImportSession(storage)).toBeNull();
  });
});
