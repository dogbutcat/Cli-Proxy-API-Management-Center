/**
 * Credential identity derivation: cards show the account identity instead of the file name.
 * React-free, consumed directly by tests/authFileIdentity.test.ts.
 *
 * Real file names look like codex-<hash8>-<email>-<plan>.json. The email sits
 * in the middle, while single-line truncation keeps the provider prefix that
 * the type badge already communicates.
 *
 * Two hard rules:
 * 1. Read only email / projectId. Backend also sends account, but api-key
 *    credentials put the API key itself in account (sdk/cliproxy/auth/types.go
 *    AccountInfo). It must never enter the card title or search haystack.
 * 2. Do not regex an email out of the file name. Codex uses '-' separators,
 *    and '-' is legal inside both the local part and the domain.
 */

import { normalizeOpenCodeGoIdentity } from '../../services/api/opencodeGo';
import type {
  OpenCodeGoIdentity,
  OpenCodeGoIdentityInput,
  OpenCodeGoIdentityStatus,
} from '../../types/opencodeGo';
import type { AuthFileItem } from '../../types/authFile';

export type AuthFileIdentityKind = 'email' | 'projectId' | 'fileName' | 'safeSource';
export type SafeSourceIdentityDiagnostic = OpenCodeGoIdentityStatus;

export type SafeSourceIdentityInput = OpenCodeGoIdentityInput;

export type SafeSourceIdentity = {
  provider: string;
  entry: string;
  workspace: string;
  project: string;
  protocol: string;
  label: string;
  identityKey: string;
  diagnostic: SafeSourceIdentityDiagnostic;
};

export type AuthFileIdentity = {
  /** Main card row. Empty means no identity signal, with no fake placeholder. */
  primary: string;
  /** Main row source. 'fileName' renders mono and suppresses a duplicate secondary row. */
  kind: AuthFileIdentityKind;
  /** Secondary card row without the .json suffix; null means render no row. */
  secondary: string | null;
  /** Original complete file name, used for title text. */
  fullName: string;
};

/** AuthFileItem has an index signature, so backend non-strings need a runtime guard. */
const readIdentityText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeAuthFileProviderKey = (value: unknown): string => {
  const key = readIdentityText(value).toLowerCase().replace(/_/g, '-');
  if (key === 'opencode' || key === 'opencodego' || key === 'opencode-go') return 'opencode-go';
  return key;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isOpenCodeGoIdentity = (value: unknown): value is OpenCodeGoIdentity =>
  isRecord(value) &&
  ('identityKey' in value || 'label' in value || 'workspace' in value || 'entry' in value);

const hasOpenCodeGoIdentitySignal = (file: AuthFileItem): boolean => {
  const type = normalizeAuthFileProviderKey(file.type);
  const provider = normalizeAuthFileProviderKey(file.provider);
  const identity = file.opencodeGoIdentity;
  return (
    type === 'opencode-go' ||
    provider === 'opencode-go' ||
    isOpenCodeGoIdentity(identity) ||
    file['opencode_go_identity'] !== undefined
  );
};

const readOpenCodeGoIdentityInput = (file: AuthFileItem): OpenCodeGoIdentityInput => {
  const existing = (
    isRecord(file.opencodeGoIdentity)
      ? file.opencodeGoIdentity
      : isRecord(file['opencode_go_identity'])
        ? file['opencode_go_identity']
        : {}
  ) as OpenCodeGoIdentityInput;

  return {
    ...existing,
    aliases:
      existing.aliases ?? file.aliases ?? file.alias ?? file['model-alias'] ?? file.model_alias,
    provider: existing.provider ?? file.provider ?? file.type,
    entry: existing.entry ?? file.authIndex ?? file['auth_index'] ?? file.name,
    workspace: existing.workspace ?? file.workspace ?? file.workspaceId ?? file['workspace_id'],
    project: existing.project ?? file.projectId ?? file['project_id'],
    protocol: existing.protocol ?? file.protocol ?? file.protocolType ?? file['protocol_type'],
    label: existing.label ?? file.label ?? file.displayName ?? file['display_name'],
    runtimeOnly: existing.runtimeOnly ?? file.runtimeOnly ?? file['runtime_only'],
    configured:
      existing.configured ??
      file.configured ??
      file.configuredPending ??
      file['configured_pending'],
    canonical: existing.canonical ?? file.canonical,
    legacy: existing.legacy ?? file.legacy,
    status: existing.status ?? file.status,
    source: existing.source ?? file.source,
    account: file.account,
    apiKey: file.apiKey ?? file['api_key'] ?? file['api-key'],
    cookie: file.cookie,
    authorization: file.authorization,
    headers: file.headers,
  };
};

const readOpenCodeGoPreferredLabel = (file: AuthFileItem): string => {
  const existing = (
    isRecord(file.opencodeGoIdentity)
      ? file.opencodeGoIdentity
      : isRecord(file['opencode_go_identity'])
        ? file['opencode_go_identity']
        : {}
  ) as OpenCodeGoIdentityInput;
  const labelSource = readIdentityText(existing.labelSource);
  if (labelSource === 'alias' || labelSource === 'label') {
    const label = readIdentityText(existing.label);
    if (label) return label;
  }
  return readIdentityText(file.label ?? file.displayName ?? file['display_name']);
};

export const deriveSafeSourceIdentity = (
  input: SafeSourceIdentityInput = {}
): SafeSourceIdentity => {
  const identity = normalizeOpenCodeGoIdentity(input);

  return {
    provider: identity.provider,
    entry: identity.entry,
    workspace: identity.workspace,
    project: identity.project,
    protocol: identity.protocol,
    label: identity.label,
    identityKey: identity.identityKey,
    diagnostic: identity.status,
  };
};

export const deriveOpenCodeGoAuthFileIdentity = (file: AuthFileItem): OpenCodeGoIdentity =>
  normalizeOpenCodeGoIdentity(readOpenCodeGoIdentityInput(file));

const buildOpenCodeGoSecondary = (identity: OpenCodeGoIdentity): string | null => {
  const parts = [identity.identityKey, identity.protocol].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};

const buildOpenCodeGoPrimary = (
  identity: OpenCodeGoIdentity,
  preferredLabel: string,
  fallbackName: string
): string =>
  preferredLabel || (identity.labelSource !== 'provider' && identity.label)
    ? preferredLabel || identity.label
    : identity.workspace ||
      identity.project ||
      identity.entry ||
      identity.protocol ||
      identity.label ||
      stripJsonExtension(fallbackName);

export const deriveOpenCodeGoDisplayIdentity = (file: AuthFileItem): AuthFileIdentity => {
  const fullName = readIdentityText(file.name);
  const identity = deriveOpenCodeGoAuthFileIdentity(file);
  const primary = buildOpenCodeGoPrimary(identity, readOpenCodeGoPreferredLabel(file), fullName);
  const secondary = buildOpenCodeGoSecondary(identity);

  return {
    primary,
    kind: 'safeSource',
    secondary,
    fullName: secondary || primary,
  };
};

/** Strip the .json suffix case-insensitively, but only when content remains. */
export const stripJsonExtension = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 5) return trimmed;
  return trimmed.toLowerCase().endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
};

/**
 * Identity fallback chain: email -> projectId -> file name without .json.
 * It intentionally stays provider-agnostic. Runtime-only virtual credentials
 * where name === email === channel ID are handled by the secondary-row dedupe.
 */
export const deriveAuthFileIdentity = (file: AuthFileItem): AuthFileIdentity => {
  if (hasOpenCodeGoIdentitySignal(file)) {
    return deriveOpenCodeGoDisplayIdentity(file);
  }

  const fullName = readIdentityText(file.name);
  const base = stripJsonExtension(fullName);
  const email = readIdentityText(file.email);
  const projectId = readIdentityText(file.projectId);

  const kind: AuthFileIdentityKind = email ? 'email' : projectId ? 'projectId' : 'fileName';
  const primary = email || projectId || base;

  const secondary =
    kind === 'fileName' || !base || base.toLowerCase() === primary.toLowerCase() ? null : base;

  return { primary, kind, secondary, fullName };
};
