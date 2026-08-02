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

export type AuthFileIdentityKind = 'email' | 'projectId' | 'fileName';
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
  normalizeOpenCodeGoIdentity({
    aliases: file.aliases ?? file.alias ?? file['model-alias'] ?? file.model_alias,
    provider: file.provider ?? file.type,
    entry: file.authIndex ?? file['auth_index'] ?? file.name,
    workspace: file.workspace ?? file.workspaceId ?? file['workspace_id'],
    project: file.projectId ?? file['project_id'],
    protocol: file.protocol ?? file.protocolType ?? file['protocol_type'],
    label: file.label ?? file.displayName ?? file['display_name'],
    runtimeOnly: file.runtimeOnly ?? file['runtime_only'],
    configured: file.configured ?? file.configuredPending ?? file['configured_pending'],
    canonical: file.canonical,
    legacy: file.legacy,
    status: file.status,
    source: file.source,
    account: file.account,
    apiKey: file.apiKey ?? file['api_key'] ?? file['api-key'],
    cookie: file.cookie,
    authorization: file.authorization,
    headers: file.headers,
  });

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
