import type { CredentialInfo, SourceInfo } from '@/types/sourceInfo';
import { buildSafeLogsPath } from '@/services/api/logs';
import { normalizeOpenCodeGoSourceIdentity } from '@/services/api/opencodeGo';
import type { MonitoringEvent } from '@/services/api/usageService';
import { buildSourceInfoMap, resolveSourceDisplay } from '@/utils/sourceResolver';
import { normalizeAuthIndex } from '@/utils/usage';
import { isMonitoringRecord, maskEmailLike, readString } from './base';
import type { MonitoringAuthMeta, MonitoringChannelMeta } from './types';

const GENERIC_PROVIDER_LABELS = new Set([
  'codex',
  'openai',
  'openai-compatibility',
  'opencode-go',
  'gemini',
  'claude',
  'vertex',
]);

const hasReadableValue = (value: string | null | undefined) => {
  const trimmed = readString(value);
  return Boolean(trimmed) && trimmed !== '-';
};

export const isGenericMonitoringProviderLabel = (value: string) =>
  GENERIC_PROVIDER_LABELS.has(value.trim().toLowerCase());

const firstReadable = (...values: Array<string | null | undefined>) =>
  values.find(hasReadableValue)?.trim() || '';

export type MonitoringSourceDisplayInput = {
  source?: string | null;
  sourceHash?: string | null;
  apiKeyHash?: string | null;
  authIndex?: unknown;
  accountSnapshot?: string | null;
  authLabelSnapshot?: string | null;
  authProviderSnapshot?: string | null;
  channel?: string | null;
  authLabel?: string | null;
  account?: string | null;
  apiKeyAlias?: string | null;
};

export type MonitoringSourceDisplayContext = {
  authMetaMap: Map<string, MonitoringAuthMeta>;
  authFileMap?: Map<string, CredentialInfo>;
  sourceInfoMap?: ReturnType<typeof buildSourceInfoMap>;
  channelByAuthIndex: Map<string, MonitoringChannelMeta>;
  apiKeyAliasMap?: Map<string, string>;
};

export type MonitoringSourceDisplay = {
  primary: string;
  meta: string;
  title: string;
  sourceLabel: string;
  sourceMasked: string;
  account: string;
  accountMasked: string;
  authIndex: string;
  channel: string;
  channelHost: string;
  provider: string;
  fallbackId: string;
  /** Full raw API key from config, when available. */
  rawApiKey?: string;
};

const shortHash = (value: string | null | undefined) => {
  const trimmed = readString(value);
  if (!trimmed) return '-';
  return trimmed.length <= 12 ? trimmed : `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};

const OPENAI_COMPAT_PREFIX = 'openai-compatible-';
const OPEN_CODE_GO_PROVIDER = 'opencode-go';
const ANTIGRAVITY_PROVIDER = 'antigravity';
const OPEN_CODE_GO_PREFIX = `${OPEN_CODE_GO_PROVIDER}-`;
const OCG_PROTOCOL_SEPARATORS = new Set(['openai', 'claude', 'anthropic']);

const splitAccountWithProviderPrefix = (value: string) => {
  const normalized = readString(value).toLowerCase();
  if (!normalized.startsWith(OPEN_CODE_GO_PREFIX)) return readString(value);
  return readString(value).slice(OPEN_CODE_GO_PREFIX.length);
};

const extractOpenCodeGoProtocol = (value: string, protocolHint?: string) => {
  const protocol = readString(protocolHint).toLowerCase();
  if (protocol) return protocol;

  const normalized = readString(value).toLowerCase();
  const withPrefix = splitAccountWithProviderPrefix(normalized);
  const direct = OCG_PROTOCOL_SEPARATORS.values();
  for (const sep of direct) {
    if (withPrefix.endsWith(`-${sep}`)) return sep;
  }
  return '';
};

const stripOpenCodeGoSuffix = (value: string, protocol?: string) => {
  let stripped = readString(value);
  if (!stripped) return '';

  const normalizedProtocol = readString(protocol).toLowerCase();
  if (normalizedProtocol && stripped.toLowerCase().endsWith(`-${normalizedProtocol}`)) {
    stripped = stripped.slice(0, -normalizedProtocol.length - 1);
  }

  return stripped;
};

const resolveOpenCodeGoAccount = (value: string, protocol?: string) =>
  stripOpenCodeGoSuffix(splitAccountWithProviderPrefix(value), protocol);

const resolveOpenCodeGoProtocol = (input: {
  generatedName: string;
  protocol: string;
  channel: string;
  providerName: string;
}) => {
  if (input.protocol) return readString(input.protocol);
  if (input.channel.includes('·')) return input.channel.split('·').pop()!.trim();
  if (input.providerName) {
    const normalizedProvider = readString(input.providerName).toLowerCase();
    const prefix = `${OPEN_CODE_GO_PROVIDER}-`;
    if (normalizedProvider.startsWith(prefix)) {
      return normalizedProvider.slice(prefix.length);
    }
  }
  return extractOpenCodeGoProtocol(input.generatedName);
};

const composeOpenCodeGoIdentity = (provider: string, account: string, protocol: string) => {
  const parts = [provider, account, protocol].filter(Boolean);
  return parts.join('-');
};

const buildMaskedAccount = (value: string) => {
  const trimmed = readString(value);
  if (!trimmed || trimmed === '-') return '-';
  if (trimmed.includes('@')) return maskEmailLike(trimmed);
  if (trimmed.length <= 3) return `${trimmed.slice(0, 1)}***`;
  if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
};

/**
 * Reconcile a byAuthIndex-resolved SourceInfo with the backend-authoritative
 * auth_provider_snapshot. When multiple providers share the same API key,
 * byAuthIndex first-write-wins may attribute to the wrong provider.
 * The snapshot is ground truth — use it to derive the correct channel name.
 */
const reconcileProviderSnapshot = (
  current: SourceInfo,
  authProviderSnapshot: string
): SourceInfo => {
  const snapshot = authProviderSnapshot.trim().toLowerCase();
  if (!snapshot) return current;
  if (current.type && snapshot.includes(current.type)) return current;
  if (!snapshot.startsWith(OPENAI_COMPAT_PREFIX)) return current;

  const channelName = authProviderSnapshot.trim().slice(OPENAI_COMPAT_PREFIX.length);
  if (!channelName) return current;

  return { ...current, type: 'openai', providerName: channelName, identityKey: `snapshot:${snapshot}` };
};

export const buildAuthFileMapFromMeta = (
  authMetaMap: Map<string, MonitoringAuthMeta>
): Map<string, CredentialInfo> => {
  const map = new Map<string, CredentialInfo>();
  authMetaMap.forEach((meta, authIndex) => {
    map.set(authIndex, {
      name: meta.label || meta.account || authIndex,
      type: meta.provider || '',
    });
  });
  return map;
};

export const buildMonitoringSourceDisplay = (
  input: MonitoringSourceDisplayInput,
  context: MonitoringSourceDisplayContext
): MonitoringSourceDisplay => {
  const authIndex = normalizeAuthIndex(input.authIndex) ?? '-';
  const authMeta = authIndex === '-' ? undefined : context.authMetaMap.get(authIndex);
  const channelMeta =
    authIndex === '-'
      ? undefined
      : context.channelByAuthIndex.get(authIndex) ||
        (authMeta?.authIndex ? context.channelByAuthIndex.get(authMeta.authIndex) : undefined);
  const sourceInfoMap = context.sourceInfoMap ?? buildSourceInfoMap({});
  const authFileMap = context.authFileMap ?? buildAuthFileMapFromMeta(context.authMetaMap);
  let sourceMeta = resolveSourceDisplay(
    readString(input.source),
    authIndex,
    sourceInfoMap,
    authFileMap
  );

  // Reconcile sourceMeta with the backend-authoritative auth_provider_snapshot.
  // Handles shared API keys where byAuthIndex first-write-wins gives the wrong provider.
  sourceMeta = reconcileProviderSnapshot(sourceMeta, readString(input.authProviderSnapshot));
  const apiKeyHash = readString(input.apiKeyHash).toLowerCase();
  const apiKeyAlias = firstReadable(
    input.apiKeyAlias,
    apiKeyHash ? context.apiKeyAliasMap?.get(apiKeyHash) : ''
  );
  const snapshotAccount = readString(input.accountSnapshot);
  const snapshotLabel = readString(input.authLabelSnapshot);
  const snapshotProvider = readString(input.authProviderSnapshot);
  const explicitChannel = readString(input.channel);
  const explicitLabel = readString(input.authLabel);
  const explicitAccount = readString(input.account);
  const sourceMetaProvider = sourceMeta.providerName || sourceMeta.type;
  const provider = firstReadable(
    authMeta?.provider,
    snapshotProvider,
    sourceMetaProvider,
    sourceMeta.type
  );
  const providerNormalized = provider.toLowerCase();
  const isOpenCodeGoProvider = providerNormalized === OPEN_CODE_GO_PROVIDER;
  const isAntigravityProvider = providerNormalized === ANTIGRAVITY_PROVIDER;
  const openCodeGoProtocol = isOpenCodeGoProvider
    ? resolveOpenCodeGoProtocol({
        generatedName: authMeta?.generatedName || '',
        protocol: authMeta?.protocol || '',
        channel: explicitChannel || '',
        providerName: sourceMetaProvider || '',
      })
    : '';
  const openCodeGoGeneratedAccount = isOpenCodeGoProvider
    ? resolveOpenCodeGoAccount(authMeta?.generatedName || '', openCodeGoProtocol)
    : '';

  const account = firstReadable(
    isOpenCodeGoProvider ? openCodeGoGeneratedAccount : '',
    isOpenCodeGoProvider ? authMeta?.keyName : '',
    authMeta?.account,
    explicitAccount,
    snapshotAccount,
    explicitLabel,
    snapshotLabel
  );
  const maskedAccount = isOpenCodeGoProvider || isAntigravityProvider ? buildMaskedAccount(account) : '';
  const hasMaskedAccount = maskedAccount && maskedAccount !== '-';
  const openCodeGoSourceLabelWithAccount = isOpenCodeGoProvider
    ? composeOpenCodeGoIdentity(
        provider || OPEN_CODE_GO_PROVIDER,
        hasMaskedAccount ? maskedAccount : '',
        openCodeGoProtocol
      )
    : '';
  const antigravitySourceLabel = isAntigravityProvider
    ? composeOpenCodeGoIdentity(ANTIGRAVITY_PROVIDER, hasMaskedAccount ? maskedAccount : '', '')
    : '';
  const sourceIdentityLabel = isOpenCodeGoProvider
    ? openCodeGoSourceLabelWithAccount
    : isAntigravityProvider
      ? antigravitySourceLabel
      : '';
  const sourceLabel = firstReadable(
    sourceIdentityLabel,
    isAntigravityProvider ? antigravitySourceLabel : '',
    authMeta?.label,
    explicitLabel,
    snapshotLabel,
    account,
    sourceMeta.displayName
  );
  // When sourceInfoMap provides a specific providerName (e.g. 'opencode-go-claude'
  // for claude multikey entries), prefer it over the channel name from
  // channelByAuthIndex which may be incorrect due to backend API merging.
  const sourceProviderName = readString(sourceMeta.providerName);
  const channel = firstReadable(
    sourceProviderName && !isGenericMonitoringProviderLabel(sourceProviderName) ? sourceProviderName : '',
    channelMeta?.name,
    explicitChannel,
    provider
  );
  const channelHost = firstReadable(channelMeta?.host);
  const sourceMasked =
    isOpenCodeGoProvider || isAntigravityProvider
      ? sourceIdentityLabel
      : maskEmailLike(sourceLabel || sourceMeta.displayName);
  const accountMasked = isOpenCodeGoProvider || isAntigravityProvider
    ? maskedAccount || '-'
    : maskEmailLike(account || sourceLabel);
  const fallbackId = shortHash(input.sourceHash || input.apiKeyHash || authIndex);
  const primary =
    firstReadable(
      channel && !isGenericMonitoringProviderLabel(channel) ? channel : '',
      channelHost,
      sourceMasked,
      provider && !isGenericMonitoringProviderLabel(provider) ? provider : '',
      accountMasked,
      apiKeyAlias,
      channel,
      provider,
      fallbackId
    ) || '-';
  const meta = firstReadable(
    provider && provider !== primary ? provider : '',
    channelHost && channelHost !== primary ? channelHost : '',
    accountMasked && accountMasked !== primary ? accountMasked : '',
    sourceMasked && sourceMasked !== primary ? sourceMasked : '',
    apiKeyAlias && apiKeyAlias !== primary ? apiKeyAlias : ''
  );
  const title = Array.from(
    new Set(
      [
        primary,
        meta,
        sourceMasked,
        accountMasked,
        channelHost,
        provider,
        authIndex !== '-' ? `#${shortHash(authIndex)}` : '',
        readString(input.sourceHash),
        readString(input.apiKeyHash),
      ].filter(hasReadableValue)
    )
  ).join(' · ');

  return {
    primary,
    meta,
    title,
    sourceLabel: sourceLabel || primary,
    sourceMasked: sourceMasked || primary,
    account: account || sourceLabel || primary,
    accountMasked: accountMasked || sourceMasked || primary,
    authIndex,
    channel: channel || '-',
    channelHost: channelHost || '-',
    provider: provider || '-',
    fallbackId,
    ...(sourceMeta.rawApiKey ? { rawApiKey: sourceMeta.rawApiKey } : {}),
  };
};

export type MonitoringSafeSourceIdentity = {
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
  readString(value).toLowerCase().replace(/_/g, '-');

const isOpenCodeProvider = (...values: unknown[]): boolean =>
  values.some((value) => OPENCODE_PROVIDER_KEYS.has(normalizeProviderKey(value)));

const maybeSetSafeQuery = (
  query: Record<string, string>,
  key: string,
  value: string | undefined
) => {
  if (value) query[key] = value;
};

export const buildMonitoringSafeLogsPath = (query: Record<string, string>): string =>
  buildSafeLogsPath(query);

export const buildMonitoringExportPath = (query: Record<string, string>): string => {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return suffix ? `/usage/export?${suffix}` : '/usage/export';
};

export const deriveMonitoringSourceIdentity = (
  event: MonitoringEvent,
  authMeta?: MonitoringAuthMeta | null,
  sourcePayload?: unknown
): MonitoringSafeSourceIdentity => {
  const sourceRecord = isMonitoringRecord(sourcePayload) ? sourcePayload : {};
  const provider =
    readString(event.authProviderSnapshot) ||
    readString(event.provider) ||
    authMeta?.provider ||
    readString(sourceRecord.provider);
  const entry =
    readString(sourceRecord.entry) ||
    readString(sourceRecord.entry_id) ||
    event.authIndex ||
    authMeta?.authIndex ||
    '';
  const workspace =
    readString(sourceRecord.workspace) ||
    readString(sourceRecord.workspace_id) ||
    readString(sourceRecord.workspaceId);
  const project =
    readString(sourceRecord.project) ||
    readString(sourceRecord.project_id) ||
    readString(sourceRecord.projectId) ||
    readString(event.authProjectIdSnapshot);
  const protocol =
    readString(sourceRecord.protocol) ||
    readString(sourceRecord.protocol_type) ||
    authMeta?.protocol ||
    '';

  const identity = isOpenCodeProvider(provider, authMeta?.provider, sourceRecord.provider)
    ? normalizeOpenCodeGoSourceIdentity({
        ...sourceRecord,
        provider,
        entry,
        workspace,
        project,
        protocol,
        label: authMeta?.label || event.authLabelSnapshot,
      })
    : null;

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
