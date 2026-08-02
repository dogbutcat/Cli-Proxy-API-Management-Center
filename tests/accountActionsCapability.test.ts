import { describe, expect, test } from 'bun:test';
import {
  applyAccountActionMutationResult,
  applyAccountActionsListResult,
  buildAccountActionsPageModel,
  createInitialAccountActionsPageData,
  loadAccountActionCandidatesPageData,
  runGuardedAccountActionMutation,
  type AccountActionsMutationApiLike,
  type AccountActionsPageApiLike,
} from '../src/features/monitoring/model/accountActionsPageModel';
import type {
  AccountActionCandidate,
  AccountActionCandidatesResponse,
  UsageApiResult,
  UsageCapabilities,
  UsageCapability,
} from '../src/services/api/usageService';

const capability = (supported: boolean, reason?: string): UsageCapabilities => ({
  schemaVersion: 1,
  accountActions: {
    supported,
    reason,
    state: supported ? 'supported' : 'unsupported',
  },
});

const supportedCapability: UsageCapability = {
  supported: true,
  state: 'supported',
};

const unsupportedCapability: UsageCapability = {
  supported: false,
  state: 'unsupported',
  reason: 'unsupported_local_sqlite',
};

const success = <T>(data: T): UsageApiResult<T> => ({ kind: 'success', data });

const error = <T>(
  message: string,
  overrides: Partial<Extract<UsageApiResult<T>, { kind: 'error' }>> = {}
): UsageApiResult<T> => ({
  kind: 'error',
  message,
  ...overrides,
});

const unsupported = <T>(
  message: string,
  code = 'account_actions_unsupported'
): UsageApiResult<T> => ({
  kind: 'unsupported',
  message,
  code,
});

const candidate = (
  id: number,
  status: AccountActionCandidate['status'],
  overrides: Partial<AccountActionCandidate> = {}
): AccountActionCandidate => ({
  id,
  actionType: 'delete',
  status,
  provider: 'opencode-go',
  authFileName: `auth-${id}.json`,
  authIndex: `auth-${id}`,
  authLabel: `Workspace ${id}`,
  reason: id === 1 ? 'repeated 401 failures' : 'manual review',
  firstSeenAtMs: 1_775_000_000_000,
  lastSeenAtMs: 1_775_000_000_000 + id,
  hitCount: id,
  createdAtMs: 1_775_000_000_000,
  updatedAtMs: 1_775_000_000_000 + id,
  ...overrides,
});

const candidates = (items: AccountActionCandidate[]): AccountActionCandidatesResponse => ({
  items,
  pendingCount: items.filter((item) => item.status === 'pending').length,
});

const pageApiFixture = (
  capabilitiesResult: UsageApiResult<UsageCapabilities>,
  listResult: UsageApiResult<AccountActionCandidatesResponse>
) => {
  const calls: string[] = [];
  const api: AccountActionsPageApiLike = {
    getCapabilities: async () => {
      calls.push('capabilities');
      return capabilitiesResult;
    },
    list: async (status, limit) => {
      calls.push(`list:${status}:${limit}`);
      return listResult;
    },
  };
  return { api, calls };
};

const mutationApiFixture = (result: UsageApiResult<{ item?: AccountActionCandidate }>) => {
  const calls: string[] = [];
  const api: AccountActionsMutationApiLike = {
    ignore: async (id) => {
      calls.push(`ignore:${id}`);
      return result;
    },
    resolve: async (id) => {
      calls.push(`resolve:${id}`);
      return result;
    },
    enable: async (id) => {
      calls.push(`enable:${id}`);
      return result;
    },
    deleteAuthFile: async (id) => {
      calls.push(`deleteAuthFile:${id}`);
      return result;
    },
  };
  return { api, calls };
};

describe('account actions capability-aware page model', () => {
  test('capability false renders unsupported without loading candidates', async () => {
    const { api, calls } = pageApiFixture(
      success(capability(false, 'unsupported_local_sqlite')),
      success(candidates([candidate(1, 'pending')]))
    );

    const data = await loadAccountActionCandidatesPageData(api, 'pending', 100);
    const model = buildAccountActionsPageModel(data);

    expect(calls).toEqual(['capabilities']);
    expect(model).toMatchObject({
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      canLoadCandidates: false,
      canMutate: false,
      feedback: 'unsupported_local_sqlite',
    });
    expect(model.rows).toEqual([]);
  });

  test('capability true loads candidates and supports status/search filtering', async () => {
    const { api, calls } = pageApiFixture(
      success(capability(true)),
      success(candidates([candidate(1, 'pending'), candidate(2, 'ignored')]))
    );

    const data = await loadAccountActionCandidatesPageData(api, 'pending', 50);
    const pendingModel = buildAccountActionsPageModel(data, '401', 'pending');
    const allModel = buildAccountActionsPageModel(data, 'workspace', 'all');

    expect(calls).toEqual(['capabilities', 'list:pending:50']);
    expect(pendingModel.canLoadCandidates).toBe(true);
    expect(pendingModel.canMutate).toBe(true);
    expect(pendingModel.filteredRows.map((row) => row.id)).toEqual([1]);
    expect(allModel.filteredRows.map((row) => row.id)).toEqual([1, 2]);
    expect(allModel.statusCounts).toMatchObject({ all: 2, pending: 1, ignored: 1 });
  });

  test('typed 501 capability result normalizes to unsupported and skips list', async () => {
    const { api, calls } = pageApiFixture(
      error('preflight returned 501', { status: 501, code: 'not_implemented' }),
      success(candidates([candidate(1, 'pending')]))
    );

    const data = await loadAccountActionCandidatesPageData(api);
    const model = buildAccountActionsPageModel(data);

    expect(calls).toEqual(['capabilities']);
    expect(model.requestState).toBe('unsupported');
    expect(model.feedback).toBe('preflight returned 501');
  });

  test('legacy unsupported list envelope and typed 501 list race both disable mutations', () => {
    const current = {
      ...createInitialAccountActionsPageData(),
      capability: supportedCapability,
      capabilityState: 'supported' as const,
      items: [candidate(1, 'pending')],
    };

    const legacy = applyAccountActionsListResult(
      current,
      unsupported('account actions are unsupported')
    );
    const typed501 = applyAccountActionsListResult(
      current,
      error('account actions preflight failed', { status: 501 })
    );

    expect(buildAccountActionsPageModel(legacy)).toMatchObject({
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      canMutate: false,
      stale: true,
    });
    expect(buildAccountActionsPageModel(typed501)).toMatchObject({
      capabilityState: 'unsupported',
      requestState: 'unsupported',
      canMutate: false,
      stale: true,
    });
  });

  test('generic list error remains an error and preserves stale candidates', () => {
    const current = applyAccountActionsListResult(
      {
        ...createInitialAccountActionsPageData(),
        capability: supportedCapability,
        capabilityState: 'supported',
      },
      success(candidates([candidate(1, 'pending')]))
    );

    const afterError = applyAccountActionsListResult(current, error('network down'));
    const model = buildAccountActionsPageModel(afterError);

    expect(model.requestState).toBe('error');
    expect(model.capabilityState).toBe('supported');
    expect(model.stale).toBe(true);
    expect(model.feedback).toBe('network down');
    expect(model.rows).toHaveLength(1);
  });

  test('mutations are capability guarded before hitting fake APIs', async () => {
    const { api, calls } = mutationApiFixture(success({ item: candidate(1, 'ignored') }));

    const outcome = await runGuardedAccountActionMutation(api, 'ignore', 1, unsupportedCapability);

    expect(outcome.status).toBe('guarded');
    expect(calls).toEqual([]);
  });

  test('mutation errors surface without replacing candidate data', async () => {
    const { api, calls } = mutationApiFixture(error('mutation rejected'));
    const current = applyAccountActionsListResult(
      {
        ...createInitialAccountActionsPageData(),
        capability: supportedCapability,
        capabilityState: 'supported',
      },
      success(candidates([candidate(1, 'pending')]))
    );

    const outcome = await runGuardedAccountActionMutation(api, 'resolve', 1, supportedCapability);
    const nextData = applyAccountActionMutationResult(current, outcome.result!, outcome.message);
    const model = buildAccountActionsPageModel(nextData);

    expect(calls).toEqual(['resolve:1']);
    expect(outcome.status).toBe('error');
    expect(model.feedback).toBe('mutation rejected');
    expect(model.rows[0]?.status).toBe('pending');
  });
});
