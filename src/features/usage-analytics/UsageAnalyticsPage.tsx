import { useMemo } from 'react';
import {
  IconFilterAll,
  IconKey,
  IconModelCluster,
  IconNetwork,
  IconRefreshCw,
  IconSatellite,
  IconShield,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { UsageAnalyticsBanners } from './components/UsageAnalyticsBanners';
import { UsageAnalyticsCards } from './components/UsageAnalyticsCards';
import { UsageAnalyticsTable } from './components/UsageAnalyticsTable';
import { useUsageAnalytics } from './useUsageAnalytics';
import {
  openUsageAnalyticsDrilldown,
  setUsageAnalyticsComparisonEnabled,
  setUsageAnalyticsFilters,
  setUsageAnalyticsGranularity,
  type UsageAnalyticsGranularity,
} from './usageAnalyticsUiState';
import type { UsageAnalyticsStatRow } from './usageAnalyticsModel';
import {
  buildUsageAnalyticsBanners,
  buildUsageAnalyticsMetricCards,
  formatUsageAnalyticsState,
  usageAnalyticsUpdatedText,
} from './usageAnalyticsPresentation';
import styles from './UsageAnalyticsPage.module.scss';

export type UsageAnalyticsPageProps = {
  enabled?: boolean;
};

export function UsageAnalyticsPage({ enabled = true }: UsageAnalyticsPageProps) {
  const analytics = useUsageAnalytics({ enabled });
  useHeaderRefresh(analytics.refresh, true);

  const cards = useMemo(() => buildUsageAnalyticsMetricCards(analytics.model), [analytics.model]);
  const banners = useMemo(() => buildUsageAnalyticsBanners(analytics.model), [analytics.model]);
  const statusText = analytics.loading
    ? 'Loading usage aggregates'
    : `${formatUsageAnalyticsState(analytics.model.state)} · ${usageAnalyticsUpdatedText(
        analytics.model
      )}`;
  const openRowDrilldown = (row: UsageAnalyticsStatRow) => {
    const filters =
      row.kind === 'model'
        ? { models: [row.id] }
        : row.kind === 'clientKey'
          ? { apiKeyHashes: [row.id] }
          : row.kind === 'credential'
            ? { authIndices: [row.id] }
            : row.kind === 'provider'
              ? { providers: [row.id] }
              : undefined;
    analytics.setUiState((previous) =>
      openUsageAnalyticsDrilldown(previous, {
        surface: row.kind,
        id: row.id,
        filters,
      })
    );
  };

  return (
    <main className={styles.page} aria-label="Usage analytics">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Usage Analytics</p>
          <h1>Usage Analytics</h1>
          <p className={styles.subtitle}>
            Server-side usage aggregates for cost, token, identity, and time-based analysis.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.statusText} aria-live="polite">
            {statusText}
          </span>
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => void analytics.refresh()}
            title="Refresh usage analytics"
            aria-label="Refresh usage analytics"
          >
            <IconRefreshCw size={18} />
          </button>
        </div>
      </header>

      <UsageAnalyticsBanners banners={banners} />

      <section className={styles.toolbar} aria-label="Usage analytics filters">
        <IconFilterAll size={18} />
        <input
          id="usage-analytics-search-input"
          className={styles.input}
          value={analytics.uiState.filters.searchQuery ?? ''}
          placeholder="Search model, provider, key, credential"
          onChange={(event) =>
            analytics.setUiState((previous) =>
              setUsageAnalyticsFilters(previous, {
                ...previous.filters,
                searchQuery: event.target.value,
              })
            )
          }
        />
        <input
          id="usage-analytics-provider-filter"
          className={styles.input}
          value={analytics.uiState.filters.providers?.[0] ?? ''}
          placeholder="Provider filter"
          onChange={(event) =>
            analytics.setUiState((previous) =>
              setUsageAnalyticsFilters(previous, {
                ...previous.filters,
                providers: event.target.value ? [event.target.value] : undefined,
              })
            )
          }
        />
        <select
          id="usage-analytics-granularity"
          className={styles.select}
          value={analytics.uiState.granularity}
          onChange={(event) =>
            analytics.setUiState((previous) =>
              setUsageAnalyticsGranularity(
                previous,
                event.target.value as UsageAnalyticsGranularity
              )
            )
          }
        >
          <option value="hour">Hourly</option>
          <option value="day">Daily</option>
        </select>
        <select
          id="usage-analytics-comparison"
          className={styles.select}
          value={analytics.uiState.comparison.enabled ? 'previousPeriod' : 'off'}
          onChange={(event) =>
            analytics.setUiState((previous) =>
              setUsageAnalyticsComparisonEnabled(previous, event.target.value === 'previousPeriod')
            )
          }
        >
          <option value="off">No comparison</option>
          <option value="previousPeriod">Previous period</option>
        </select>
        <label className={styles.toggleLabel} htmlFor="usage-analytics-include-failed">
          <input
            id="usage-analytics-include-failed"
            type="checkbox"
            checked={analytics.uiState.filters.includeFailed ?? true}
            onChange={(event) =>
              analytics.setUiState((previous) =>
                setUsageAnalyticsFilters(previous, {
                  ...previous.filters,
                  includeFailed: event.target.checked,
                })
              )
            }
          />
          Include failed
        </label>
      </section>

      <UsageAnalyticsCards cards={cards} />

      <section className={styles.surfaceGrid} aria-label="Usage analytics surfaces">
        <article className={styles.surfaceCard}>
          <IconSatellite size={20} />
          <div>
            <strong>Overview</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.overview)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconSatellite size={20} />
          <div>
            <strong>Trend</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.trend)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconModelCluster size={20} />
          <div>
            <strong>Models</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.models)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconNetwork size={20} />
          <div>
            <strong>Provider usage</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.providerUsage)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconKey size={20} />
          <div>
            <strong>Client keys</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.clientKeys)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconShield size={20} />
          <div>
            <strong>Credentials</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.credentials)}</span>
          </div>
        </article>
        <article className={styles.surfaceCard}>
          <IconNetwork size={20} />
          <div>
            <strong>Heatmap</strong>
            <span>{formatUsageAnalyticsState(analytics.model.surfaces.heatmap)}</span>
          </div>
        </article>
      </section>

      <UsageAnalyticsTable
        title="Trend"
        emptyText="No trend aggregate rows were returned."
        rows={analytics.model.trend}
      />
      <UsageAnalyticsTable
        title="Models"
        emptyText="No model aggregate rows were returned."
        rows={analytics.model.models}
        onDrilldown={openRowDrilldown}
      />
      <UsageAnalyticsTable
        title="Client keys"
        emptyText="No client-key aggregate rows were returned."
        rows={analytics.model.clientKeys}
        onDrilldown={openRowDrilldown}
      />
      <UsageAnalyticsTable
        title="Credentials"
        emptyText="No credential aggregate rows were returned."
        rows={analytics.model.credentials}
        onDrilldown={openRowDrilldown}
      />
      <UsageAnalyticsTable
        title="Providers"
        emptyText="No provider aggregate rows were returned."
        rows={analytics.model.providerUsage}
        onDrilldown={openRowDrilldown}
      />
      <UsageAnalyticsTable
        title="Heatmap"
        emptyText="No heatmap aggregate rows were returned."
        rows={analytics.model.heatmap}
      />
    </main>
  );
}
