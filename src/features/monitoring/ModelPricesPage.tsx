import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconDollarSign,
  IconPencil,
  IconRefreshCw,
  IconSearch,
  IconTrash2,
} from '@/components/ui/icons';
import { modelPricesApi } from '@/services/api';
import type { ModelPricesResponse, UsageApiResult } from '@/services/api/usageService';
import { formatUnixTimestamp } from '@/utils/format';
import {
  applyModelPricesListResult,
  applyModelPricesMutationResult,
  applyModelPricesSummaryResult,
  buildModelPricesPageModel,
  createInitialModelPricesPageData,
  createModelPriceMutationGuard,
  runGuardedModelPriceDelete,
  runGuardedModelPriceSave,
  runGuardedModelPriceSync,
  type ModelPriceMutationKind,
  type ModelPricesPageData,
} from './model/modelPricesPageModel';
import {
  buildModelPriceFromDraft,
  createDefaultModelPricesPageUiState,
  fillModelPricesDraft,
  setModelPricesMutationFeedback,
  setModelPricesMutationPending,
  setModelPricesSearchQuery,
  type ModelPricesDraft,
} from './modelPricesPageUiState';

const DASH = '-';

const styles = {
  page: {
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 16,
    alignItems: 'end',
    padding: '20px 0 4px',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(30px, 4vw, 46px)',
    lineHeight: 1.04,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '10px 0 0',
    color: 'var(--text-secondary)',
    maxWidth: 760,
  },
  statusLine: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
  },
  input: {
    minWidth: 160,
    flex: '1 1 180px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  numberInput: {
    minWidth: 120,
    flex: '1 1 120px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  disabledButton: {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  primaryButton: {
    borderColor: 'var(--accent-color)',
    background: 'var(--accent-color)',
    color: 'var(--button-text, #fff)',
  },
  dangerButton: {
    borderColor: 'color-mix(in srgb, var(--danger-color, #d14) 60%, var(--border-color))',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  },
  metric: {
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 14,
    background: 'var(--bg-secondary)',
  },
  metricLabel: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metricValue: {
    margin: '8px 0 0',
    fontSize: 24,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  panel: {
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    padding: 14,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
    gap: 10,
    alignItems: 'end',
  },
  fieldLabel: {
    display: 'grid',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 900,
  },
  th: {
    textAlign: 'left',
    padding: '11px 12px',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-color)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    verticalAlign: 'top',
  },
  mono: {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    fontSize: 12,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: '4px 8px',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  issue: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--amber-color, #c78100) 45%, transparent)',
    background: 'color-mix(in srgb, var(--amber-color, #c78100) 10%, transparent)',
    color: 'var(--text-primary)',
  },
} satisfies Record<string, CSSProperties>;

const mergeStyle = (...items: CSSProperties[]): CSSProperties => Object.assign({}, ...items);

const formatPrice = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : DASH;

const labelForOperation = (operation: ModelPriceMutationKind): string => {
  if (operation === 'save') return 'Save';
  if (operation === 'delete') return 'Delete';
  return 'Sync';
};

const applyMutationData = (
  data: ModelPricesPageData,
  result: UsageApiResult<ModelPricesResponse>
): ModelPricesPageData => applyModelPricesMutationResult(data, result);

export function ModelPricesPage() {
  const [data, setData] = useState<ModelPricesPageData>(() => createInitialModelPricesPageData());
  const [uiState, setUiState] = useState(() => createDefaultModelPricesPageUiState());
  const [loading, setLoading] = useState(false);

  const pageModel = useMemo(
    () => buildModelPricesPageModel(data, uiState.searchQuery),
    [data, uiState.searchQuery]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setData((previous) => ({ ...previous, requestState: 'loading' }));
    const [pricesResult, summaryResult] = await Promise.all([
      modelPricesApi.getPrices(),
      modelPricesApi.getUsageSummary(250),
    ]);
    setData((previous) =>
      applyModelPricesSummaryResult(
        applyModelPricesListResult(previous, pricesResult),
        summaryResult
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (patch: Partial<ModelPricesDraft>) => {
    setUiState((previous) => ({
      ...previous,
      draft: {
        ...previous.draft,
        ...patch,
      },
    }));
  };

  const runSave = async () => {
    const model = uiState.draft.model.trim();
    if (!model) {
      setUiState((previous) =>
        setModelPricesMutationFeedback(previous, 'error', 'save', 'Model name is required.')
      );
      return;
    }
    setUiState((previous) => setModelPricesMutationPending(previous, 'save'));
    const nextPrices = {
      ...data.prices,
      [model]: buildModelPriceFromDraft(uiState.draft),
    };
    const outcome = await runGuardedModelPriceSave(
      modelPricesApi,
      nextPrices,
      createModelPriceMutationGuard(uiState.confirmSave)
    );
    const mutationResult = outcome.result;
    if (mutationResult) setData((previous) => applyMutationData(previous, mutationResult));
    setUiState((previous) =>
      setModelPricesMutationFeedback(previous, outcome.status, outcome.operation, outcome.message)
    );
  };

  const runDelete = async () => {
    const model = uiState.deleteCandidate;
    if (!model) return;
    setUiState((previous) => setModelPricesMutationPending(previous, 'delete'));
    const outcome = await runGuardedModelPriceDelete(
      modelPricesApi,
      model,
      createModelPriceMutationGuard(uiState.confirmDelete)
    );
    const mutationResult = outcome.result;
    if (mutationResult) setData((previous) => applyMutationData(previous, mutationResult));
    setUiState((previous) =>
      setModelPricesMutationFeedback(previous, outcome.status, outcome.operation, outcome.message)
    );
  };

  const runSync = async () => {
    setUiState((previous) => setModelPricesMutationPending(previous, 'sync'));
    const models = pageModel.filteredRows.map((row) => row.model);
    const outcome = await runGuardedModelPriceSync(
      modelPricesApi,
      models.length ? models : undefined,
      createModelPriceMutationGuard(uiState.confirmSync)
    );
    const mutationResult = outcome.result;
    if (mutationResult) setData((previous) => applyMutationData(previous, mutationResult));
    setUiState((previous) =>
      setModelPricesMutationFeedback(previous, outcome.status, outcome.operation, outcome.message)
    );
  };

  const updatedText = data.updatedAtMs ? formatUnixTimestamp(data.updatedAtMs) : DASH;
  const issueText = [pageModel.feedback, pageModel.summaryFeedback].filter(Boolean).join(' ');
  const mutationBusy = uiState.mutationFeedback.status === 'pending';

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Model Prices</h1>
          <p style={styles.subtitle}>Manual pricing table and usage-driven sync summary.</p>
        </div>
        <div style={styles.statusLine}>
          <span>Updated {updatedText}</span>
          {pageModel.stale && <span>stale last-good list</span>}
          {pageModel.partial && <span>partial data</span>}
        </div>
      </header>

      <section style={styles.toolbar} aria-label="Model price actions">
        <IconSearch size={18} aria-hidden="true" />
        <input
          id="model-prices-search"
          style={styles.input}
          value={uiState.searchQuery}
          placeholder="Search models"
          onChange={(event) =>
            setUiState((previous) => setModelPricesSearchQuery(previous, event.target.value))
          }
        />
        <button
          id="model-prices-refresh"
          type="button"
          style={mergeStyle(styles.button, loading ? styles.disabledButton : {})}
          disabled={loading}
          onClick={() => void load()}
        >
          <IconRefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
        <label style={styles.checkboxLabel}>
          <input
            id="model-prices-confirm-sync"
            type="checkbox"
            checked={uiState.confirmSync}
            onChange={(event) =>
              setUiState((previous) => ({ ...previous, confirmSync: event.target.checked }))
            }
          />
          Confirm sync
        </label>
        <button
          id="model-prices-sync"
          type="button"
          style={mergeStyle(
            styles.button,
            styles.primaryButton,
            mutationBusy ? styles.disabledButton : {}
          )}
          disabled={mutationBusy}
          onClick={() => void runSync()}
        >
          <IconRefreshCw size={16} aria-hidden="true" />
          Sync
        </button>
      </section>

      {issueText && (
        <section style={styles.issue} aria-live="polite">
          <IconAlertTriangle size={16} aria-hidden="true" />
          <span>{issueText}</span>
        </section>
      )}

      {uiState.mutationFeedback.message && (
        <section style={styles.issue} aria-live="polite">
          {uiState.mutationFeedback.status === 'success' ? (
            <IconCheckCircle2 size={16} aria-hidden="true" />
          ) : (
            <IconAlertTriangle size={16} aria-hidden="true" />
          )}
          <span>
            {labelForOperation(uiState.mutationFeedback.operation)}:{' '}
            {uiState.mutationFeedback.message}
          </span>
        </section>
      )}

      <section style={styles.summaryGrid} aria-label="Model price summary">
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Rows</p>
          <p style={styles.metricValue}>{pageModel.rows.length.toLocaleString()}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Priced</p>
          <p style={styles.metricValue}>{pageModel.pricedCount.toLocaleString()}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Missing</p>
          <p style={styles.metricValue}>{pageModel.missingCount.toLocaleString()}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Usage calls</p>
          <p style={styles.metricValue}>{pageModel.totalCalls.toLocaleString()}</p>
        </div>
      </section>

      <section style={styles.panel} aria-label="Manual model price editor">
        <div style={styles.formGrid}>
          <label style={styles.fieldLabel}>
            Model
            <input
              id="model-prices-draft-model"
              style={styles.input}
              value={uiState.draft.model}
              onChange={(event) => updateDraft({ model: event.target.value })}
            />
          </label>
          <label style={styles.fieldLabel}>
            Input
            <input
              id="model-prices-draft-input"
              style={styles.numberInput}
              value={uiState.draft.input}
              inputMode="decimal"
              onChange={(event) => updateDraft({ input: event.target.value })}
            />
          </label>
          <label style={styles.fieldLabel}>
            Output
            <input
              id="model-prices-draft-output"
              style={styles.numberInput}
              value={uiState.draft.output}
              inputMode="decimal"
              onChange={(event) => updateDraft({ output: event.target.value })}
            />
          </label>
          <label style={styles.fieldLabel}>
            Cache read
            <input
              id="model-prices-draft-cache-read"
              style={styles.numberInput}
              value={uiState.draft.cacheRead}
              inputMode="decimal"
              onChange={(event) => updateDraft({ cacheRead: event.target.value })}
            />
          </label>
          <label style={styles.fieldLabel}>
            Unit
            <input
              id="model-prices-draft-unit"
              style={styles.numberInput}
              value={uiState.draft.unit}
              inputMode="numeric"
              onChange={(event) => updateDraft({ unit: event.target.value })}
            />
          </label>
          <label style={styles.fieldLabel}>
            Currency
            <input
              id="model-prices-draft-currency"
              style={styles.numberInput}
              value={uiState.draft.currency}
              onChange={(event) => updateDraft({ currency: event.target.value })}
            />
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <label style={styles.checkboxLabel}>
            <input
              id="model-prices-confirm-save"
              type="checkbox"
              checked={uiState.confirmSave}
              onChange={(event) =>
                setUiState((previous) => ({ ...previous, confirmSave: event.target.checked }))
              }
            />
            Confirm save
          </label>
          <button
            id="model-prices-save"
            type="button"
            style={mergeStyle(
              styles.button,
              styles.primaryButton,
              mutationBusy ? styles.disabledButton : {}
            )}
            disabled={mutationBusy}
            onClick={() => void runSave()}
          >
            <IconDollarSign size={16} aria-hidden="true" />
            Save
          </button>
        </div>
      </section>

      <section style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Model</th>
              <th style={styles.th}>State</th>
              <th style={styles.th}>Input</th>
              <th style={styles.th}>Output</th>
              <th style={styles.th}>Cache read</th>
              <th style={styles.th}>Unit</th>
              <th style={styles.th}>Usage</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageModel.filteredRows.map((row) => (
              <tr key={row.model}>
                <td style={styles.td}>
                  <strong>{row.model}</strong>
                  <div style={styles.mono}>{row.currency}</div>
                </td>
                <td style={styles.td}>
                  <span style={styles.badge}>{row.priceState}</span>
                </td>
                <td style={styles.td}>{formatPrice(row.price?.input)}</td>
                <td style={styles.td}>{formatPrice(row.price?.output)}</td>
                <td style={styles.td}>{formatPrice(row.price?.cacheRead ?? row.price?.cached)}</td>
                <td style={styles.td}>{row.unit.toLocaleString()}</td>
                <td style={styles.td}>
                  {row.calls.toLocaleString()}
                  <div style={styles.mono}>
                    req {row.requestedCalls.toLocaleString()} / resolved{' '}
                    {row.resolvedCalls.toLocaleString()}
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      id={`model-prices-edit-${row.model}`}
                      type="button"
                      style={styles.button}
                      onClick={() =>
                        setUiState((previous) => ({
                          ...previous,
                          draft: fillModelPricesDraft(row.model, row.price),
                        }))
                      }
                    >
                      <IconPencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      id={`model-prices-delete-pick-${row.model}`}
                      type="button"
                      style={mergeStyle(styles.button, styles.dangerButton)}
                      onClick={() =>
                        setUiState((previous) => ({
                          ...previous,
                          deleteCandidate: row.model,
                          confirmDelete: false,
                        }))
                      }
                    >
                      <IconTrash2 size={15} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {uiState.deleteCandidate && (
        <section style={styles.panel} aria-label="Delete model price confirmation">
          <strong>Delete {uiState.deleteCandidate}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <label style={styles.checkboxLabel}>
              <input
                id="model-prices-confirm-delete"
                type="checkbox"
                checked={uiState.confirmDelete}
                onChange={(event) =>
                  setUiState((previous) => ({ ...previous, confirmDelete: event.target.checked }))
                }
              />
              Confirm delete
            </label>
            <button
              id="model-prices-delete"
              type="button"
              style={mergeStyle(
                styles.button,
                styles.dangerButton,
                mutationBusy ? styles.disabledButton : {}
              )}
              disabled={mutationBusy}
              onClick={() => void runDelete()}
            >
              <IconTrash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
