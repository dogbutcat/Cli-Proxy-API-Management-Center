import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconLoader2,
  IconRefreshCw,
  IconSearch,
  IconShield,
  IconTrash2,
} from '@/components/ui/icons';
import { accountActionsApi, usageServiceApi } from '@/services/api';
import { formatUnixTimestamp } from '@/utils/format';
import {
  ACCOUNT_ACTION_STATUS_FILTERS,
  applyAccountActionMutationResult,
  buildAccountActionsPageModel,
  createInitialAccountActionsPageData,
  loadAccountActionCandidatesPageData,
  runGuardedAccountActionMutation,
  type AccountActionMutationKind,
  type AccountActionsPageData,
  type AccountActionStatusFilter,
} from './model/accountActionsPageModel';
import styles from './AccountActionCandidatesPage.module.scss';

const DASH = '-';
const LIST_LIMIT = 100;

const accountActionsPageApi = {
  getCapabilities: usageServiceApi.getCapabilities,
  list: accountActionsApi.list,
};

const STATUS_LABELS: Record<AccountActionStatusFilter, string> = {
  pending: 'Pending',
  all: 'All',
  ignored: 'Ignored',
  resolved: 'Resolved',
  deleted: 'Deleted',
};

const MUTATION_LABELS: Record<AccountActionMutationKind, string> = {
  ignore: 'Ignore',
  resolve: 'Resolve',
  enable: 'Enable',
  deleteAuthFile: 'Delete auth file',
};

const formatCount = (value: number): string => value.toLocaleString();

const mutationMessagePrefix = (operation: AccountActionMutationKind): string =>
  MUTATION_LABELS[operation];

const isActionBusy = (
  pending: { id: number; operation: AccountActionMutationKind } | null,
  id: number,
  operation: AccountActionMutationKind
): boolean => pending?.id === id && pending.operation === operation;

export function AccountActionCandidatesPage() {
  const [data, setData] = useState<AccountActionsPageData>(() =>
    createInitialAccountActionsPageData()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountActionStatusFilter>('pending');
  const [loading, setLoading] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error' | 'guarded';
    operation: AccountActionMutationKind | null;
    message: string | null;
  }>({ status: 'idle', operation: null, message: null });
  const [pendingMutation, setPendingMutation] = useState<{
    id: number;
    operation: AccountActionMutationKind;
  } | null>(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const pageModel = useMemo(
    () => buildAccountActionsPageModel(data, searchQuery, statusFilter),
    [data, searchQuery, statusFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setData((previous) => ({
      ...previous,
      capabilityState: 'loading',
      requestState: previous.capabilityState === 'supported' ? 'loading' : previous.requestState,
    }));
    const nextData = await loadAccountActionCandidatesPageData(
      accountActionsPageApi,
      statusFilter,
      LIST_LIMIT,
      dataRef.current
    );
    setData(nextData);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const runMutation = async (operation: AccountActionMutationKind, id: number) => {
    setMutationFeedback({ status: 'pending', operation, message: null });
    setPendingMutation({ id, operation });
    const outcome = await runGuardedAccountActionMutation(
      accountActionsApi,
      operation,
      id,
      data.capability
    );
    if (outcome.result) {
      setData((previous) =>
        applyAccountActionMutationResult(previous, outcome.result!, outcome.message)
      );
    }
    setMutationFeedback({
      status: outcome.status,
      operation: outcome.operation,
      message: outcome.message,
    });
    setPendingMutation(null);
  };

  const updatedText = data.updatedAtMs ? formatUnixTimestamp(data.updatedAtMs) : DASH;
  const mutationBusy = mutationFeedback.status === 'pending';
  const unsupported = pageModel.capabilityState === 'unsupported';
  const showTable = !unsupported && pageModel.requestState !== 'unsupported';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Account Actions</h1>
          <p className={styles.subtitle}>
            Review backend-proposed account actions with capability-aware safeguards.
          </p>
        </div>
        <div className={styles.statusLine}>
          <span>Updated {updatedText}</span>
          <span>Capability {pageModel.capabilityState}</span>
          {pageModel.stale && <span>stale last-good list</span>}
        </div>
      </header>

      <section className={styles.toolbar} aria-label="Account action candidates controls">
        <div className={styles.searchBox}>
          <IconSearch size={16} aria-hidden="true" />
          <input
            id="account-actions-search"
            className={styles.input}
            value={searchQuery}
            placeholder="Search accounts, files, reasons"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <select
          id="account-actions-status"
          className={styles.select}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as AccountActionStatusFilter)}
        >
          {ACCOUNT_ACTION_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button
          id="account-actions-refresh"
          type="button"
          className={styles.button}
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <IconLoader2 size={16} className={styles.spin} aria-hidden="true" />
          ) : (
            <IconRefreshCw size={16} aria-hidden="true" />
          )}
          Refresh
        </button>
      </section>

      <nav className={styles.tabs} aria-label="Account action status tabs">
        {ACCOUNT_ACTION_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            id={`account-actions-tab-${status}`}
            type="button"
            className={`${styles.tab} ${statusFilter === status ? styles.tabActive : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {STATUS_LABELS[status]} {formatCount(pageModel.statusCounts[status] ?? 0)}
          </button>
        ))}
      </nav>

      {pageModel.feedback && (
        <section className={styles.banner} aria-live="polite">
          {unsupported ? (
            <IconShield size={16} aria-hidden="true" />
          ) : (
            <IconAlertTriangle size={16} aria-hidden="true" />
          )}
          <span>{pageModel.feedback}</span>
        </section>
      )}

      {mutationFeedback.message && (
        <section className={styles.banner} aria-live="polite">
          {mutationFeedback.status === 'success' ? (
            <IconCheckCircle2 size={16} aria-hidden="true" />
          ) : (
            <IconAlertTriangle size={16} aria-hidden="true" />
          )}
          <span>
            {mutationMessagePrefix(mutationFeedback.operation ?? 'ignore')}:{' '}
            {mutationFeedback.message}
          </span>
        </section>
      )}

      <section className={styles.metricGrid} aria-label="Account actions summary">
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Visible</p>
          <p className={styles.metricValue}>{formatCount(pageModel.filteredRows.length)}</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Candidates</p>
          <p className={styles.metricValue}>{formatCount(pageModel.rows.length)}</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Pending</p>
          <p className={styles.metricValue}>{formatCount(pageModel.pendingCount)}</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>Mutations</p>
          <p className={styles.metricValue}>{pageModel.canMutate ? 'Enabled' : 'Blocked'}</p>
        </div>
      </section>

      {unsupported && (
        <section className={styles.unsupportedPanel} aria-label="Account actions unsupported">
          <strong>Account actions are intentionally unavailable.</strong>
          <p>{pageModel.feedback ?? 'This backend did not advertise account action support.'}</p>
        </section>
      )}

      {showTable && (
        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Account</th>
                <th className={styles.th}>Action</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Reason</th>
                <th className={styles.th}>Seen</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageModel.filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.td}>
                    <strong>{row.authLabel || row.authFileName}</strong>
                    <div className={styles.mono}>
                      {[row.provider, row.authFileName, row.authIndex].filter(Boolean).join(' / ')}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.badge}>{row.actionType}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.badge}>{row.status}</span>
                  </td>
                  <td className={styles.td}>
                    {row.reason || DASH}
                    {row.lastError && <div className={styles.mono}>{row.lastError}</div>}
                  </td>
                  <td className={styles.td}>
                    {row.hitCount.toLocaleString()} hits
                    <div className={styles.mono}>{formatUnixTimestamp(row.lastSeenAtMs)}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.rowActions}>
                      <button
                        id={`account-actions-ignore-${row.id}`}
                        type="button"
                        className={styles.button}
                        disabled={
                          !pageModel.canMutate ||
                          mutationBusy ||
                          row.status === 'ignored' ||
                          row.status === 'deleted'
                        }
                        onClick={() => void runMutation('ignore', row.id)}
                      >
                        {isActionBusy(pendingMutation, row.id, 'ignore') ? (
                          <IconLoader2 size={14} className={styles.spin} aria-hidden="true" />
                        ) : (
                          <IconShield size={14} aria-hidden="true" />
                        )}
                        Ignore
                      </button>
                      <button
                        id={`account-actions-resolve-${row.id}`}
                        type="button"
                        className={styles.button}
                        disabled={
                          !pageModel.canMutate ||
                          mutationBusy ||
                          row.status === 'resolved' ||
                          row.status === 'deleted'
                        }
                        onClick={() => void runMutation('resolve', row.id)}
                      >
                        <IconCheckCircle2 size={14} aria-hidden="true" />
                        Resolve
                      </button>
                      <button
                        id={`account-actions-enable-${row.id}`}
                        type="button"
                        className={styles.button}
                        disabled={!pageModel.canMutate || mutationBusy || row.status === 'pending'}
                        onClick={() => void runMutation('enable', row.id)}
                      >
                        <IconRefreshCw size={14} aria-hidden="true" />
                        Enable
                      </button>
                      <button
                        id={`account-actions-delete-auth-file-${row.id}`}
                        type="button"
                        className={`${styles.button} ${styles.dangerButton}`}
                        disabled={
                          !pageModel.canMutate || mutationBusy || row.actionType !== 'delete'
                        }
                        onClick={() => void runMutation('deleteAuthFile', row.id)}
                      >
                        <IconTrash2 size={14} aria-hidden="true" />
                        Delete auth file
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageModel.filteredRows.length === 0 && (
            <div className={styles.emptyState}>No account action candidates matched.</div>
          )}
        </section>
      )}
    </main>
  );
}

export default AccountActionCandidatesPage;
