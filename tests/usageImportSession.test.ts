import { describe, expect, test } from 'bun:test';
import {
  assertUsageImportSessionRedacted,
  normalizeUsageImportSession,
  serializeUsageImportSessionCreateRequest,
  type WireUsageImportSession,
} from '../src/services/api/usageService';

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
