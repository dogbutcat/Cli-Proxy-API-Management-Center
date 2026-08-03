import type { CodexQuotaWindow, CodexUsagePayload } from './quota';
import type { ModelAlias } from './provider';

export type OpenCodeGoIdentityStatus =
  'canonical' | 'legacy' | 'runtime-only' | 'configured-pending' | 'empty';

export type OpenCodeGoIdentityKeySource = 'workspace' | 'project' | 'entry' | 'empty';

export type OpenCodeGoIdentityLabelSource =
  'alias' | 'provider' | 'entry' | 'workspace' | 'project' | 'protocol' | 'label' | 'empty';

export interface OpenCodeGoIdentityInput {
  aliases?: unknown;
  alias?: unknown;
  type?: unknown;
  provider?: unknown;
  entry?: unknown;
  entryId?: unknown;
  entry_id?: unknown;
  authIndex?: unknown;
  auth_index?: unknown;
  workspace?: unknown;
  workspaceId?: unknown;
  workspace_id?: unknown;
  project?: unknown;
  projectId?: unknown;
  project_id?: unknown;
  protocol?: unknown;
  protocol_type?: unknown;
  label?: unknown;
  displayName?: unknown;
  display_name?: unknown;
  title?: unknown;
  name?: unknown;
  runtimeOnly?: unknown;
  configured?: unknown;
  configuredPending?: unknown;
  canonical?: unknown;
  legacy?: unknown;
  status?: unknown;
  source?: unknown;
  account?: unknown;
  apiKey?: unknown;
  api_key?: unknown;
  cookie?: unknown;
  cookies?: unknown;
  authorization?: unknown;
  headers?: unknown;
  [key: string]: unknown;
}

export interface OpenCodeGoIdentityDiagnostic {
  status: OpenCodeGoIdentityStatus;
  keySource: OpenCodeGoIdentityKeySource;
  labelSource: OpenCodeGoIdentityLabelSource;
  ignoredUnsafeFields: string[];
}

export interface OpenCodeGoIdentity {
  provider: string;
  entry: string;
  workspace: string;
  project: string;
  protocol: string;
  alias: string;
  label: string;
  identityKey: string;
  status: OpenCodeGoIdentityStatus;
  diagnostic: OpenCodeGoIdentityStatus;
  diagnostics: OpenCodeGoIdentityDiagnostic[];
  keySource: OpenCodeGoIdentityKeySource;
  labelSource: OpenCodeGoIdentityLabelSource;
  ignoredUnsafeFields: string[];
}

export interface OpenCodeGoQuotaGroupWire extends OpenCodeGoIdentityInput {
  id?: unknown;
  identity?: unknown;
  sourceIdentity?: unknown;
  source_identity?: unknown;
  quota?: unknown;
  usage?: unknown;
  buckets?: unknown;
  windows?: unknown;
  rows?: unknown;
  items?: unknown;
}

export interface OpenCodeGoQuotaGroup {
  id: string;
  label: string;
  provider: string;
  entry: string;
  workspace: string;
  protocol: string;
  identity: OpenCodeGoIdentity;
  raw: OpenCodeGoQuotaGroupWire;
}

export interface OpenCodeGoEntry {
  identity: OpenCodeGoIdentity;
  raw: OpenCodeGoIdentityInput;
}

export interface OpenCodeGoQuotaEntry {
  identity: OpenCodeGoIdentity;
  windows: CodexQuotaWindow[];
  usage: CodexUsagePayload | null;
  raw: OpenCodeGoQuotaGroupWire;
}

export interface OpenCodeGoQuotaIdentityGroup {
  identityKey: string;
  identity: OpenCodeGoIdentity;
  entries: OpenCodeGoQuotaEntry[];
  windows: CodexQuotaWindow[];
  diagnostic: OpenCodeGoIdentityStatus;
}

export interface OpenCodeGoResponse {
  entries: OpenCodeGoEntry[];
  diagnostics: OpenCodeGoIdentityStatus[];
}

export interface OpenCodeGoQuotaResponse {
  groups: OpenCodeGoQuotaIdentityGroup[];
  entries: OpenCodeGoQuotaEntry[];
  diagnostics: OpenCodeGoIdentityStatus[];
}

export interface OpenCodeGoQuotaWindow {
  usagePercent: number;
  percentRemaining: number;
  resetInSec: number;
  resetTimeISO?: string;
}

export interface OpenCodeGoQuota {
  rolling?: OpenCodeGoQuotaWindow;
  weekly?: OpenCodeGoQuotaWindow;
  monthly?: OpenCodeGoQuotaWindow;
}

export interface OpenCodeGoQuotaResult {
  entry_name: string;
  quota?: OpenCodeGoQuota;
  error?: string;
  timestamp: string;
}

export interface OpenCodeGoReferralResponse {
  workspace: string;
  code?: string;
  url?: string;
  raw: unknown;
}

export type OpenCodeGoModelEntry = ModelAlias;

export interface OpenCodeGoProtocolConfig {
  nameSuffix?: string;
  baseUrl: string;
  prefix?: string;
  priority?: number;
  models?: OpenCodeGoModelEntry[];
  raw?: Record<string, unknown>;
}

export interface OpenCodeGoKeyEntry {
  keyName: string;
  apiKey: string;
  proxyUrl?: string;
  workspaceId?: string;
  authCookie?: string;
  authIndices?: Record<string, string>;
  raw?: Record<string, unknown>;
}

export interface OpenCodeGoKeyGroup {
  namePrefix: string;
  disabled?: boolean;
  disableCooling?: boolean;
  headers?: Record<string, string>;
  openai?: OpenCodeGoProtocolConfig;
  anthropic?: OpenCodeGoProtocolConfig;
  keys: OpenCodeGoKeyEntry[];
  authIndexes?: Record<string, Record<string, string>>;
  identity?: OpenCodeGoIdentity;
  raw?: Record<string, unknown>;
}

export interface OpenCodeGoQuotaConfig {
  pollInterval?: string;
  threshold?: number;
  raw?: Record<string, unknown>;
}

export interface OpenCodeGoConfig {
  keyGroups: OpenCodeGoKeyGroup[];
  quota?: OpenCodeGoQuotaConfig;
  raw?: Record<string, unknown>;
}
