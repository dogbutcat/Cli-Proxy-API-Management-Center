import { useMemo, type CSSProperties } from 'react';
import {
  IconAlertTriangle,
  IconDownload,
  IconFilterAll,
  IconKey,
  IconRefreshCw,
  IconScrollText,
  IconSatellite,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { formatCompactNumber, formatPercent, formatUnixTimestamp } from '@/utils/format';
import type { AuthFileItem } from '@/types/authFile';
import {
  buildMonitoringExportQuery,
  readNextMonitoringCursor,
} from './model/monitoringCenterPageModel';
import { buildMonitoringExportPath } from './model/sourceDisplay';
import {
  MONITORING_TABS,
  setMonitoringDensity,
  setMonitoringFilters,
  setMonitoringTab,
  type MonitoringDensity,
  type MonitoringTab,
} from './monitoringCenterUiState';
import { useMonitoringData } from './hooks/useMonitoringData';

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
    fontSize: 'clamp(30px, 4vw, 48px)',
    lineHeight: 1.04,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '10px 0 0',
    color: 'var(--text-secondary)',
    maxWidth: 760,
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
    minWidth: 220,
    flex: '1 1 240px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  select: {
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
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  tabButton: {
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '12px 14px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  activeTab: {
    borderColor: 'var(--accent-color)',
    color: 'var(--text-primary)',
    boxShadow: 'inset 0 -2px 0 var(--accent-color)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 760,
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
  statusLine: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
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

const tabLabels: Record<MonitoringTab, string> = {
  accounts: 'Accounts',
  keys: 'Keys',
  realtime: 'Realtime',
};

type MonitoringCenterPageProps = {
  authFiles?: AuthFileItem[];
};

const formatLatency = (value: number | null): string =>
  value === null ? DASH : `${Math.round(value).toLocaleString()} ms`;

const formatMoney = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);

const mergeStyle = (...items: CSSProperties[]): CSSProperties => Object.assign({}, ...items);

export function MonitoringCenterPage({ authFiles = [] }: MonitoringCenterPageProps) {
  const {
    uiState,
    setUiState,
    usage,
    analytics,
    accountRows,
    apiKeyRows,
    eventRows,
    loadNextPage,
  } = useMonitoringData({ authFiles });

  useHeaderRefresh(analytics.refresh, true);

  const summary = analytics.analytics?.summary;
  const cursor = readNextMonitoringCursor(analytics.analytics);
  const exportPath = useMemo(
    () => buildMonitoringExportPath(buildMonitoringExportQuery(uiState)),
    [uiState]
  );
  const statusText =
    analytics.loading && !analytics.analytics
      ? 'Loading monitoring data'
      : analytics.result?.kind === 'unsupported'
        ? analytics.result.message
        : analytics.error || `Updated ${analytics.updatedAtMs ? formatUnixTimestamp(analytics.updatedAtMs) : DASH}`;
  const issueText =
    analytics.result?.kind === 'empty'
      ? 'No monitoring events matched the current filters.'
      : analytics.result?.kind === 'unsupported'
        ? analytics.result.message
        : analytics.error;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Monitoring</h1>
          <p style={styles.subtitle}>Last 24 hours</p>
        </div>
        <div style={styles.statusLine}>
          <span>{statusText}</span>
          {usage.status?.kind === 'success' && <span>{usage.status.data.events} events</span>}
        </div>
      </header>

      <section style={styles.toolbar} aria-label="Monitoring filters">
        <IconFilterAll size={18} aria-hidden="true" />
        <input
          id="monitoring-search-input"
          style={styles.input}
          value={uiState.filters.searchQuery ?? ''}
          placeholder="Search model, source, trace, endpoint"
          onChange={(event) =>
            setUiState((previous) =>
              setMonitoringFilters(previous, {
                ...previous.filters,
                searchQuery: event.target.value,
              })
            )
          }
        />
        <select
          id="monitoring-provider-filter"
          style={styles.select}
          value={uiState.filters.providers?.[0] ?? ''}
          onChange={(event) =>
            setUiState((previous) =>
              setMonitoringFilters(previous, {
                ...previous.filters,
                providers: event.target.value ? [event.target.value] : undefined,
              })
            )
          }
        >
          <option value="">All providers</option>
          {analytics.selectors.providers.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          id="monitoring-density"
          style={styles.select}
          value={uiState.density}
          onChange={(event) =>
            setUiState((previous) =>
              setMonitoringDensity(previous, event.target.value as MonitoringDensity)
            )
          }
        >
          <option value="compact">Compact</option>
          <option value="full">Full</option>
        </select>
        <button
          id="monitoring-refresh"
          type="button"
          style={styles.button}
          onClick={() => void analytics.refresh()}
        >
          <IconRefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
        <a id="monitoring-export" style={styles.button} href={exportPath}>
          <IconDownload size={16} aria-hidden="true" />
          Export
        </a>
      </section>

      {issueText && (
        <section style={styles.issue} aria-live="polite">
          <IconAlertTriangle size={16} aria-hidden="true" />
          <span>{issueText}</span>
        </section>
      )}

      <section style={styles.tabs} aria-label="Monitoring sections">
        {MONITORING_TABS.map((tab) => (
          <button
            id={`monitoring-tab-${tab}`}
            key={tab}
            type="button"
            style={mergeStyle(styles.tabButton, uiState.activeTab === tab ? styles.activeTab : {})}
            onClick={() => setUiState((previous) => setMonitoringTab(previous, tab))}
          >
            {tab === 'accounts' && <IconSatellite size={16} aria-hidden="true" />}
            {tab === 'keys' && <IconKey size={16} aria-hidden="true" />}
            {tab === 'realtime' && <IconScrollText size={16} aria-hidden="true" />}
            <strong>{tabLabels[tab]}</strong>
          </button>
        ))}
      </section>

      <section style={styles.summaryGrid} aria-label="Monitoring summary">
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Calls</p>
          <p style={styles.metricValue}>{formatCompactNumber(summary?.totalCalls ?? 0)}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Success rate</p>
          <p style={styles.metricValue}>{formatPercent(summary?.successRate ?? 0)}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Tokens</p>
          <p style={styles.metricValue}>{formatCompactNumber(summary?.totalTokens ?? 0)}</p>
        </div>
        <div style={styles.metric}>
          <p style={styles.metricLabel}>Cost</p>
          <p style={styles.metricValue}>{formatMoney(summary?.totalCost ?? 0)}</p>
        </div>
      </section>

      {uiState.activeTab === 'accounts' && (
        <section style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Account</th>
                <th style={styles.th}>Channels</th>
                <th style={styles.th}>Calls</th>
                <th style={styles.th}>Failures</th>
                <th style={styles.th}>Tokens</th>
                <th style={styles.th}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>
                    <strong>{row.displayAccount}</strong>
                    <div style={styles.mono}>{row.authIndices.join(', ') || DASH}</div>
                  </td>
                  <td style={styles.td}>{row.channels.join(', ') || DASH}</td>
                  <td style={styles.td}>{row.totalCalls.toLocaleString()}</td>
                  <td style={styles.td}>{row.failureCalls.toLocaleString()}</td>
                  <td style={styles.td}>{formatCompactNumber(row.totalTokens)}</td>
                  <td style={styles.td}>{formatLatency(row.averageLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {uiState.activeTab === 'keys' && (
        <section style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Key</th>
                <th style={styles.th}>Sources</th>
                <th style={styles.th}>Calls</th>
                <th style={styles.th}>Failures</th>
                <th style={styles.th}>Tokens</th>
                <th style={styles.th}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {apiKeyRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>
                    <strong>{row.apiKeyLabel}</strong>
                    <div style={styles.mono}>{row.apiKeyHash}</div>
                  </td>
                  <td style={styles.td}>{row.sourceLabels.join(', ') || DASH}</td>
                  <td style={styles.td}>{row.totalCalls.toLocaleString()}</td>
                  <td style={styles.td}>{row.failureCalls.toLocaleString()}</td>
                  <td style={styles.td}>{formatCompactNumber(row.totalTokens)}</td>
                  <td style={styles.td}>{formatMoney(row.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {uiState.activeTab === 'realtime' && (
        <section style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Source</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Endpoint</th>
                <th style={styles.th}>Tokens</th>
                <th style={styles.th}>Logs</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{formatUnixTimestamp(row.timestampMs)}</td>
                  <td style={styles.td}>
                    <strong>{row.label}</strong>
                    <div style={styles.mono}>{row.authIndex || DASH}</div>
                  </td>
                  <td style={styles.td}>{row.model}</td>
                  <td style={styles.td}>{row.endpoint}</td>
                  <td style={styles.td}>{formatCompactNumber(row.totalTokens)}</td>
                  <td style={styles.td}>
                    <a href={row.logsPath}>Open logs</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={styles.mono}>
              next_before_ms={cursor.beforeMs ?? DASH} next_before_id={cursor.beforeId ?? DASH}
            </span>
            <button
              id="monitoring-load-more"
              type="button"
              style={styles.button}
              disabled={!analytics.hasMore || analytics.loading}
              onClick={() => void loadNextPage()}
            >
              Load more
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
