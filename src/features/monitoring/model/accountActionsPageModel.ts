import type {
  AccountActionCandidate,
  AccountActionCandidatesResponse,
  AccountActionStatus,
  UsageApiResult,
  UsageCapabilities,
  UsageCapability,
} from '@/services/api/usageService';

export const ACCOUNT_ACTION_STATUS_FILTERS = [
  'pending',
  'all',
  'ignored',
  'resolved',
  'deleted',
] as const;

export type AccountActionStatusFilter = (typeof ACCOUNT_ACTION_STATUS_FILTERS)[number];
export type AccountActionsCapabilityState =
  'idle' | 'loading' | 'supported' | 'unsupported' | 'error';
export type AccountActionsRequestState =
  'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unsupported';
export type AccountActionMutationKind = 'ignore' | 'resolve' | 'enable' | 'deleteAuthFile';
export type AccountActionMutationStatus = 'success' | 'error' | 'guarded';

export type AccountActionsPageData = {
  capability: UsageCapability | null;
  capabilityState: AccountActionsCapabilityState;
  requestState: AccountActionsRequestState;
  items: AccountActionCandidate[];
  pendingCount: number;
  stale: boolean;
  feedback: string | null;
  updatedAtMs: number | null;
};

export type AccountActionRow = AccountActionCandidate & {
  searchableText: string;
};

export type AccountActionsPageModel = {
  rows: AccountActionRow[];
  filteredRows: AccountActionRow[];
  capabilityState: AccountActionsCapabilityState;
  requestState: AccountActionsRequestState;
  canLoadCandidates: boolean;
  canMutate: boolean;
  stale: boolean;
  feedback: string | null;
  pendingCount: number;
  statusCounts: Record<AccountActionStatusFilter, number>;
};

export type AccountActionsPageApiLike = {
  getCapabilities: () => Promise<UsageApiResult<UsageCapabilities>>;
  list: (
    status?: AccountActionStatusFilter,
    limit?: number
  ) => Promise<UsageApiResult<AccountActionCandidatesResponse>>;
};

export type AccountActionsMutationApiLike = {
  ignore: (id: number) => Promise<UsageApiResult<{ item?: AccountActionCandidate }>>;
  resolve: (id: number) => Promise<UsageApiResult<{ item?: AccountActionCandidate }>>;
  enable: (id: number) => Promise<UsageApiResult<{ item?: AccountActionCandidate }>>;
  deleteAuthFile: (id: number) => Promise<UsageApiResult<{ item?: AccountActionCandidate }>>;
};

export type AccountActionMutationOutcome = {
  status: AccountActionMutationStatus;
  operation: AccountActionMutationKind;
  message: string;
  result?: UsageApiResult<{ item?: AccountActionCandidate }>;
};

const DEFAULT_UNSUPPORTED_REASON = 'Account actions are unsupported by this backend.';
const DEFAULT_LIST_ERROR = 'Account action candidates request failed.';
const DEFAULT_MUTATION_ERROR = 'Account action mutation failed.';

export const createInitialAccountActionsPageData = (): AccountActionsPageData => ({
  capability: null,
  capabilityState: 'idle',
  requestState: 'idle',
  items: [],
  pendingCount: 0,
  stale: false,
  feedback: null,
  updatedAtMs: null,
});

const isUnsupportedCode = (code: string | undefined): boolean =>
  Boolean(code?.toLowerCase().includes('unsupported'));

const isUnsupportedMessage = (message: string | undefined): boolean =>
  Boolean(message?.toLowerCase().includes('unsupported'));

export const isTypedUnsupportedResult = (result: UsageApiResult<unknown>): boolean => {
  if (result.kind === 'unsupported') return true;
  return (
    result.kind === 'error' &&
    (result.status === 501 ||
      isUnsupportedCode(result.code) ||
      isUnsupportedMessage(result.message))
  );
};

const readResultMessage = (result: UsageApiResult<unknown>, fallback: string): string => {
  if (result.kind === 'unsupported' || result.kind === 'error') return result.message || fallback;
  if (result.status?.errors.length) return result.status.errors[0]?.message ?? fallback;
  if (result.status?.warnings.length) return result.status.warnings[0]?.message ?? fallback;
  return fallback;
};

const unsupportedCapability = (reason: string): UsageCapability => ({
  supported: false,
  reason,
  state: 'unsupported',
});

const normalizeUnsupportedReason = (
  result: UsageApiResult<unknown>,
  fallback = DEFAULT_UNSUPPORTED_REASON
): string => readResultMessage(result, fallback);

export const isAccountActionsCapabilitySupported = (
  capability: UsageCapability | null | undefined
): capability is UsageCapability & { supported: true; state: 'supported' } =>
  capability?.supported === true && capability.state === 'supported';

export const applyAccountActionsCapabilityResult = (
  current: AccountActionsPageData,
  result: UsageApiResult<UsageCapabilities>
): AccountActionsPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    const capability = result.data.accountActions;
    if (isAccountActionsCapabilitySupported(capability)) {
      return {
        ...current,
        capability,
        capabilityState: 'supported',
        requestState: 'idle',
        feedback: null,
      };
    }
    const reason = capability.reason || DEFAULT_UNSUPPORTED_REASON;
    return {
      ...current,
      capability: { ...capability, supported: false, state: 'unsupported', reason },
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      stale: current.items.length > 0,
      feedback: reason,
    };
  }

  if (isTypedUnsupportedResult(result)) {
    const reason = normalizeUnsupportedReason(result);
    return {
      ...current,
      capability:
        result.kind === 'unsupported'
          ? (result.capabilities?.accountActions ?? unsupportedCapability(reason))
          : unsupportedCapability(reason),
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      stale: current.items.length > 0,
      feedback: reason,
    };
  }

  return {
    ...current,
    capability: null,
    capabilityState: 'error',
    requestState: 'error',
    stale: current.items.length > 0,
    feedback: readResultMessage(result, 'Account actions capability check failed.'),
  };
};

export const applyAccountActionsListResult = (
  current: AccountActionsPageData,
  result: UsageApiResult<AccountActionCandidatesResponse>,
  nowMs = Date.now()
): AccountActionsPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    return {
      ...current,
      items: result.data.items,
      pendingCount: result.data.pendingCount,
      requestState: result.data.items.length === 0 ? 'empty' : 'ready',
      stale: Boolean(result.status?.stale),
      feedback:
        result.kind === 'empty' || result.data.items.length === 0
          ? 'No account action candidates matched.'
          : null,
      updatedAtMs: nowMs,
    };
  }

  if (isTypedUnsupportedResult(result)) {
    const reason = normalizeUnsupportedReason(result);
    return {
      ...current,
      capability: unsupportedCapability(reason),
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      stale: current.items.length > 0,
      feedback: reason,
    };
  }

  return {
    ...current,
    requestState: 'error',
    stale: current.items.length > 0,
    feedback: readResultMessage(result, DEFAULT_LIST_ERROR),
  };
};

export const applyAccountActionMutationResult = (
  current: AccountActionsPageData,
  result: UsageApiResult<{ item?: AccountActionCandidate }>,
  fallbackMessage = 'Account action updated.'
): AccountActionsPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    const item = result.data.item;
    return {
      ...current,
      items: item
        ? current.items.map((candidate) => (candidate.id === item.id ? item : candidate))
        : current.items,
      feedback: fallbackMessage,
      updatedAtMs: Date.now(),
    };
  }

  if (isTypedUnsupportedResult(result)) {
    const reason = normalizeUnsupportedReason(result);
    return {
      ...current,
      capability: unsupportedCapability(reason),
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      stale: current.items.length > 0,
      feedback: reason,
    };
  }

  return {
    ...current,
    feedback: readResultMessage(result, DEFAULT_MUTATION_ERROR),
  };
};

const normalizeQuery = (query: string): string => query.trim().toLowerCase();

const candidateSearchText = (candidate: AccountActionCandidate): string =>
  [
    candidate.actionType,
    candidate.status,
    candidate.provider,
    candidate.authFileName,
    candidate.authIndex,
    candidate.authLabel,
    candidate.reason,
    candidate.lastError,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const candidateMatchesStatus = (
  candidate: AccountActionCandidate,
  statusFilter: AccountActionStatusFilter
): boolean => statusFilter === 'all' || candidate.status === statusFilter;

const compareCandidates = (a: AccountActionCandidate, b: AccountActionCandidate): number => {
  if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
  if (b.lastSeenAtMs !== a.lastSeenAtMs) return b.lastSeenAtMs - a.lastSeenAtMs;
  return a.authFileName.localeCompare(b.authFileName);
};

export const buildAccountActionsPageModel = (
  data: AccountActionsPageData,
  searchQuery = '',
  statusFilter: AccountActionStatusFilter = 'pending'
): AccountActionsPageModel => {
  const rows = data.items
    .map((candidate): AccountActionRow => ({
      ...candidate,
      searchableText: candidateSearchText(candidate),
    }))
    .sort(compareCandidates);
  const query = normalizeQuery(searchQuery);
  const filteredRows = rows.filter(
    (row) =>
      candidateMatchesStatus(row, statusFilter) && (!query || row.searchableText.includes(query))
  );
  const statusCounts = ACCOUNT_ACTION_STATUS_FILTERS.reduce(
    (counts, filter) => ({
      ...counts,
      [filter]:
        filter === 'all'
          ? rows.length
          : rows.filter((row) => row.status === (filter as AccountActionStatus)).length,
    }),
    {} as Record<AccountActionStatusFilter, number>
  );

  return {
    rows,
    filteredRows,
    capabilityState: data.capabilityState,
    requestState: data.requestState,
    canLoadCandidates: data.capabilityState === 'supported',
    canMutate: isAccountActionsCapabilitySupported(data.capability),
    stale: data.stale,
    feedback: data.feedback,
    pendingCount: data.pendingCount,
    statusCounts,
  };
};

export const loadAccountActionCandidatesPageData = async (
  api: AccountActionsPageApiLike,
  statusFilter: AccountActionStatusFilter = 'pending',
  limit = 100,
  current: AccountActionsPageData = createInitialAccountActionsPageData()
): Promise<AccountActionsPageData> => {
  const capabilityData = applyAccountActionsCapabilityResult(current, await api.getCapabilities());
  if (capabilityData.capabilityState !== 'supported') return capabilityData;
  return applyAccountActionsListResult(capabilityData, await api.list(statusFilter, limit));
};

const guardedOutcome = (operation: AccountActionMutationKind): AccountActionMutationOutcome => ({
  status: 'guarded',
  operation,
  message: 'Account actions are unsupported by this backend.',
});

const mutationSuccessMessage = (operation: AccountActionMutationKind): string => {
  if (operation === 'ignore') return 'Candidate ignored.';
  if (operation === 'resolve') return 'Candidate resolved.';
  if (operation === 'enable') return 'Candidate enabled.';
  return 'Auth file deletion requested.';
};

export const runGuardedAccountActionMutation = async (
  api: AccountActionsMutationApiLike,
  operation: AccountActionMutationKind,
  id: number,
  capability: UsageCapability | null | undefined
): Promise<AccountActionMutationOutcome> => {
  if (!isAccountActionsCapabilitySupported(capability)) return guardedOutcome(operation);
  const result = await api[operation](id);
  if (result.kind === 'success' || result.kind === 'empty') {
    return {
      status: 'success',
      operation,
      message: mutationSuccessMessage(operation),
      result,
    };
  }
  return {
    status: 'error',
    operation,
    message: readResultMessage(result, DEFAULT_MUTATION_ERROR),
    result,
  };
};
