import { normalizeOpenCodeGoSourceIdentity } from '@/services/api/opencodeGo';
import type { MonitoringEvent } from '@/services/api/usageService';
import type { OpenCodeGoIdentity } from '@/types/opencodeGo';
import { isMonitoringRecord, readMonitoringString } from './base';
import type { MonitoringAuthMeta } from './types';

export type MonitoringSourceDisplay = {
  label: string;
  identityKey: string;
  provider: string;
  protocol: string;
  workspace: string;
  entry: string;
  safeQuery: Record<string, string>;
  unsafeFields: string[];
};

const OPENCODE_PROVIDER_KEYS = new Set(['opencode', 'opencode-go', 'opencodego']);

const normalizeProviderKey = (value: unknown): string =>
  readMonitoringString(value).toLowerCase().replace(/_/g, '-');

const isOpenCodeProvider = (...values: unknown[]): boolean =>
  values.some((value) => OPENCODE_PROVIDER_KEYS.has(normalizeProviderKey(value)));

const maybeSetSafeQuery = (
  query: Record<string, string>,
  key: string,
  value: string | undefined
) => {
  if (value) query[key] = value;
};

export const buildMonitoringSafeLogsPath = (query: Record<string, string>): string => {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return suffix ? `/logs?${suffix}` : '/logs';
};

export const buildMonitoringExportPath = (query: Record<string, string>): string => {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return suffix ? `/usage/export?${suffix}` : '/usage/export';
};

export const deriveMonitoringSourceIdentity = (
  event: MonitoringEvent,
  authMeta?: MonitoringAuthMeta | null,
  sourcePayload?: unknown
): MonitoringSourceDisplay => {
  const sourceRecord = isMonitoringRecord(sourcePayload) ? sourcePayload : {};
  const provider =
    readMonitoringString(event.authProviderSnapshot) ||
    readMonitoringString(event.provider) ||
    authMeta?.provider ||
    readMonitoringString(sourceRecord.provider);
  const entry =
    readMonitoringString(sourceRecord.entry) ||
    readMonitoringString(sourceRecord.entry_id) ||
    event.authIndex ||
    authMeta?.authIndex ||
    '';
  const workspace =
    readMonitoringString(sourceRecord.workspace) ||
    readMonitoringString(sourceRecord.workspace_id) ||
    readMonitoringString(sourceRecord.workspaceId);
  const project =
    readMonitoringString(sourceRecord.project) ||
    readMonitoringString(sourceRecord.project_id) ||
    readMonitoringString(sourceRecord.projectId) ||
    readMonitoringString(event.authProjectIdSnapshot);
  const protocol =
    readMonitoringString(sourceRecord.protocol) ||
    readMonitoringString(sourceRecord.protocol_type) ||
    authMeta?.protocol ||
    '';

  let identity: OpenCodeGoIdentity | null = null;
  if (isOpenCodeProvider(provider, authMeta?.provider, sourceRecord.provider)) {
    identity = normalizeOpenCodeGoSourceIdentity({
      ...sourceRecord,
      provider,
      entry,
      workspace,
      project,
      protocol,
      label: authMeta?.label || event.authLabelSnapshot,
    });
  }

  const safeQuery: Record<string, string> = {};
  maybeSetSafeQuery(safeQuery, 'provider', identity?.provider || provider);
  maybeSetSafeQuery(safeQuery, 'auth_index', event.authIndex || authMeta?.authIndex);
  maybeSetSafeQuery(safeQuery, 'source_hash', event.sourceHash);
  maybeSetSafeQuery(safeQuery, 'identity_key', identity?.identityKey);
  maybeSetSafeQuery(safeQuery, 'workspace', identity?.workspace || workspace);
  maybeSetSafeQuery(safeQuery, 'entry', identity?.entry || entry);
  maybeSetSafeQuery(safeQuery, 'protocol', identity?.protocol || protocol);

  return {
    label:
      identity?.label ||
      authMeta?.label ||
      event.authLabelSnapshot ||
      event.accountSnapshot ||
      event.authIndex ||
      event.sourceHash ||
      'Unknown source',
    identityKey: identity?.identityKey || event.authIndex || event.sourceHash,
    provider: identity?.provider || provider,
    protocol: identity?.protocol || protocol,
    workspace: identity?.workspace || workspace,
    entry: identity?.entry || entry,
    safeQuery,
    unsafeFields: identity?.ignoredUnsafeFields ?? [],
  };
};
