import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconBot,
  IconChartLine,
  IconDatabaseZap,
  IconFileText,
  IconKey,
  IconRefreshCw,
  IconSidebarConfig,
  IconSidebarLogs,
  IconSidebarMonitor,
  IconSidebarQuota,
} from '@/components/ui/icons';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  formatCompactNumber,
  formatDateValue,
  formatFileSize,
  formatPercent,
  formatUnixTimestamp,
} from '@/utils/format';
import { Meter } from './components/Meter';
import { Sparkline } from './components/Sparkline';
import { ThroughputChart } from './components/ThroughputChart';
import { useDashboardOverview } from './hooks/useDashboardOverview';
import {
  formatRoutingStrategyLabel,
  providerLabel,
  splitWindowMinutes,
  toneForSuccessRate,
  type MeterTone,
} from './utils';
import styles from './DashboardPage.module.scss';

const DASH = '-';

const TILE_ACCENTS: Record<MeterTone, string> = {
  good: 'var(--viz-success)',
  warning: 'var(--amber-color)',
  critical: 'var(--viz-failure)',
  idle: 'var(--text-quaternary)',
};

const formatHeadline = (value: number): string =>
  value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

type IconNode = React.ReactNode;

interface StatTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: IconNode;
  to: string;
  meter?: number | null;
  tone?: MeterTone;
}

interface RuntimeRow {
  label: string;
  value: string;
  tone?: 'on' | 'off';
  mono?: boolean;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);

  const {
    connectionStatus,
    connected,
    config,
    counts,
    providerKeyCounts,
    traffic,
    providers,
    credentials,
    usage,
    refresh,
    authFilesLoading,
  } = useDashboardOverview();

  useHeaderRefresh(refresh, connected);

  const windowLabel = useMemo(() => {
    if (traffic.windowMinutes <= 0) return DASH;
    const { hours, minutes } = splitWindowMinutes(traffic.windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);

  const unknownProviderLabel = t('dashboard.provider_unknown');
  const successRateTone = toneForSuccessRate(traffic.successRate);
  const usageSummary = usage.summary;
  const usageStatus = usage.status;
  const providerTraffic = providers.slice(0, 7);

  const statusLabel = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );

  const statusTone =
    connectionStatus === 'connected'
      ? styles.statusConnected
      : connectionStatus === 'connecting'
        ? styles.statusConnecting
        : styles.statusDisconnected;

  const routingStrategy = useMemo(
    () => formatRoutingStrategyLabel(t, config?.routingStrategy) || DASH,
    [config?.routingStrategy, t]
  );

  const providerBreakdown = useMemo(
    () =>
      [
        ['gemini', providerKeyCounts?.gemini ?? 0],
        ['interactions', providerKeyCounts?.interactions ?? 0],
        ['codex', providerKeyCounts?.codex ?? 0],
        ['claude', providerKeyCounts?.claude ?? 0],
        ['xai', providerKeyCounts?.xai ?? 0],
        ['vertex', providerKeyCounts?.vertex ?? 0],
        ['openai', providerKeyCounts?.openai ?? 0],
      ]
        .map(([id, count]) => ({ id: String(id), count: Number(count) }))
        .filter((item) => item.count > 0),
    [providerKeyCounts]
  );

  const heroSparkPoints = useMemo(
    () => traffic.buckets.map((bucket) => bucket.success + bucket.failed),
    [traffic.buckets]
  );

  const statTiles: StatTile[] = [
    {
      key: 'success',
      label: t('dashboard.success_rate'),
      value: traffic.successRate === null ? DASH : formatPercent(traffic.successRate),
      hint: t('dashboard.stat_success_hint', { total: traffic.total.toLocaleString() }),
      icon: <IconChartLine size={20} />,
      to: '/monitoring',
      meter: traffic.successRate,
      tone: successRateTone,
    },
    {
      key: 'credentials',
      label: t('dashboard.stat_credentials'),
      value: credentials ? credentials.total.toLocaleString() : DASH,
      hint: credentials
        ? t('dashboard.stat_credentials_hint', {
            active: credentials.active,
            disabled: credentials.disabled + credentials.unavailable,
          })
        : t('dashboard.stat_credentials_empty'),
      icon: <IconFileText size={20} />,
      to: '/auth-files',
      meter:
        credentials && credentials.total > 0
          ? (credentials.active / credentials.total) * 100
          : null,
      tone: credentials && credentials.disabled + credentials.unavailable > 0 ? 'warning' : 'good',
    },
    {
      key: 'providerKeys',
      label: t('dashboard.stat_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
      hint: t('dashboard.stat_provider_keys_hint'),
      icon: <IconKey size={20} />,
      to: '/ai-providers',
    },
    {
      key: 'models',
      label: t('dashboard.stat_models'),
      value: counts.models === null ? DASH : counts.models.toLocaleString(),
      hint: t('dashboard.stat_models_hint'),
      icon: <IconBot size={20} />,
      to: '/system#available-models',
    },
  ];

  const todayUsageRows = usageSummary
    ? [
        {
          label: t('dashboard.usage_calls_success', { defaultValue: 'Succeeded' }),
          value: usageSummary.today.successCalls.toLocaleString(),
        },
        {
          label: t('dashboard.usage_calls_failed', { defaultValue: 'Failed' }),
          value: usageSummary.today.failureCalls.toLocaleString(),
        },
        {
          label: t('dashboard.usage_avg_latency', { defaultValue: 'Avg latency' }),
          value:
            usageSummary.today.averageLatencyMs === null
              ? DASH
              : `${Math.round(usageSummary.today.averageLatencyMs).toLocaleString()} ms`,
        },
        {
          label: t('dashboard.usage_cost', { defaultValue: 'Cost' }),
          value: new Intl.NumberFormat(i18n.language, {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: usageSummary.today.totalCost >= 1 ? 2 : 4,
          }).format(usageSummary.today.totalCost),
        },
      ]
    : [];

  const tokenRows = usageSummary
    ? [
        {
          label: t('dashboard.usage_input_tokens', { defaultValue: 'Input' }),
          value: formatCompactNumber(usageSummary.today.inputTokens),
        },
        {
          label: t('dashboard.usage_output_tokens', { defaultValue: 'Output' }),
          value: formatCompactNumber(usageSummary.today.outputTokens),
        },
        {
          label: t('dashboard.usage_reasoning_tokens', { defaultValue: 'Reasoning' }),
          value: formatCompactNumber(usageSummary.today.reasoningTokens),
        },
        {
          label: t('dashboard.usage_cached_tokens', { defaultValue: 'Cached' }),
          value: formatCompactNumber(
            usageSummary.today.cachedTokens +
              usageSummary.today.cacheReadTokens +
              usageSummary.today.cacheCreationTokens
          ),
        },
      ]
    : [];

  const collectorRows = usageStatus
    ? [
        {
          label: t('dashboard.usage_store_events', { defaultValue: 'Events' }),
          value: usageStatus.events.toLocaleString(),
        },
        {
          label: t('dashboard.usage_store_dead_letters', { defaultValue: 'Dead letters' }),
          value: usageStatus.deadLetters.toLocaleString(),
        },
        {
          label: t('dashboard.usage_store_size', { defaultValue: 'Store size' }),
          value: formatFileSize(usageStatus.dbSizeBytes),
        },
        {
          label: t('dashboard.usage_collector_queue', { defaultValue: 'Collector queue' }),
          value: usageStatus.collector?.queueSize.toLocaleString() ?? DASH,
        },
      ]
    : [];

  const runtimeRows: RuntimeRow[] = [
    { label: t('dashboard.runtime_routing'), value: routingStrategy },
    { label: t('dashboard.runtime_retry'), value: String(config?.requestRetry ?? 0) },
    {
      label: t('dashboard.runtime_management_keys'),
      value: counts.managementKeys === null ? DASH : String(counts.managementKeys),
    },
    { label: t('dashboard.runtime_version'), value: serverVersion?.trim() || DASH },
    {
      label: t('dashboard.runtime_build'),
      value: formatDateValue(serverBuildDate, i18n.language) || DASH,
    },
    { label: t('dashboard.runtime_proxy'), value: config?.proxyUrl?.trim() || DASH, mono: true },
    {
      label: t('dashboard.runtime_debug'),
      value: config?.debug ? t('common.enabled') : t('common.disabled'),
      tone: config?.debug ? 'on' : 'off',
    },
    {
      label: t('dashboard.runtime_file_logging'),
      value: config?.loggingToFile ? t('common.enabled') : t('common.disabled'),
      tone: config?.loggingToFile ? 'on' : 'off',
    },
    {
      label: t('dashboard.runtime_request_log'),
      value: config?.requestLog ? t('common.enabled') : t('common.disabled'),
      tone: config?.requestLog ? 'on' : 'off',
    },
    {
      label: t('dashboard.runtime_ws_auth'),
      value: config?.wsAuth ? t('common.enabled') : t('common.disabled'),
      tone: config?.wsAuth ? 'on' : 'off',
    },
  ];

  const usageStatusText =
    usage.loading && !usageSummary
      ? t('dashboard.usage_state_loading', { defaultValue: 'Loading usage data' })
      : usage.unsupported
        ? t('dashboard.usage_state_unsupported', { defaultValue: 'Usage store unsupported' })
        : usage.stale
          ? t('dashboard.usage_state_stale', { defaultValue: 'Showing last good usage data' })
          : usage.partial
            ? t('dashboard.usage_state_partial', { defaultValue: 'Partial usage data' })
            : usage.updatedAtMs
              ? t('dashboard.usage_state_updated', {
                  defaultValue: 'Updated {{time}}',
                  time: formatUnixTimestamp(usage.updatedAtMs, i18n.language),
                })
              : t('dashboard.usage_state_idle', { defaultValue: 'Waiting for usage data' });

  const issueCount =
    (credentials?.disabled ?? 0) +
    (credentials?.unavailable ?? 0) +
    traffic.totalFailure +
    usage.issues.length;

  const actions = [
    {
      to: '/ai-providers',
      icon: <IconBot size={18} />,
      label: t('nav.ai_providers'),
      meta: t('dashboard.cta_providers_desc'),
    },
    {
      to: '/monitoring',
      icon: <IconSidebarMonitor size={18} />,
      label: t('nav.monitoring'),
      meta: t('dashboard.cta_inspect_logs', { defaultValue: 'Inspect logs' }),
    },
    {
      to: '/quota',
      icon: <IconSidebarQuota size={18} />,
      label: t('nav.quota_management'),
      meta: t('dashboard.cta_quota_desc'),
    },
    {
      to: '/config',
      icon: <IconSidebarConfig size={18} />,
      label: t('nav.config_management'),
      meta: t('dashboard.cta_config_desc'),
    },
    {
      to: '/logs',
      icon: <IconSidebarLogs size={18} />,
      label: t('nav.logs'),
      meta: t('dashboard.cta_logs_desc'),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.eyebrow}>{t('nav.dashboard')}</span>
          <h1>{t('dashboard.title', { defaultValue: 'Dashboard' })}</h1>
          <div className={styles.headerMeta}>
            <span className={`${styles.statusPill} ${statusTone}`}>
              <i aria-hidden="true" />
              {statusLabel}
            </span>
            <span className={styles.metaText}>{apiBase || DASH}</span>
            {serverVersion && <span className={styles.metaText}>v{serverVersion}</span>}
          </div>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={!connected}
        >
          <IconRefreshCw size={17} />
          {t('common.refresh')}
        </button>
      </header>

      <section className={styles.overviewGrid} aria-label={t('dashboard.stats_aria')}>
        <article className={`${styles.panel} ${styles.trafficSummary}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.hero_requests_label', { defaultValue: 'Requests handled' })}
              </span>
              <h2>{connected ? formatHeadline(traffic.total) : DASH}</h2>
            </div>
            <span className={`${styles.metricBadge} ${styles[`tone_${successRateTone}`]}`}>
              {traffic.successRate === null ? DASH : formatPercent(traffic.successRate)}
            </span>
          </div>
          <Sparkline
            points={heroSparkPoints}
            ariaLabel={t('dashboard.hero_spark_label', { window: windowLabel })}
            className={styles.summarySparkline}
          />
          <div className={styles.summaryFooter}>
            <span>{t('dashboard.hero_window_meta', { window: windowLabel })}</span>
            <span>
              {t('stats.success')} {traffic.totalSuccess.toLocaleString()} / {t('stats.failure')}{' '}
              {traffic.totalFailure.toLocaleString()}
            </span>
          </div>
        </article>

        {statTiles.map((tile) => (
          <Link key={tile.key} className={`${styles.panel} ${styles.statTile}`} to={tile.to}>
            <div
              className={styles.statIcon}
              style={
                {
                  '--tile-accent': tile.tone ? TILE_ACCENTS[tile.tone] : 'var(--color-primary)',
                } as React.CSSProperties
              }
            >
              {tile.icon}
            </div>
            <span className={styles.statLabel}>{tile.label}</span>
            <strong>{tile.value}</strong>
            {tile.meter !== undefined && (
              <Meter
                value={tile.meter}
                tone={tile.tone}
                ariaLabel={tile.label}
                className={styles.statMeter}
              />
            )}
            <p>{tile.hint}</p>
          </Link>
        ))}
      </section>

      <section className={styles.mainGrid}>
        <article className={`${styles.panel} ${styles.chartPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.traffic_overview', { defaultValue: 'Traffic overview' })}
              </span>
              <h2>{t('dashboard.traffic_window_title', { defaultValue: 'Recent request flow' })}</h2>
            </div>
            <Link to="/monitoring" className={styles.panelLink}>
              {t('nav.monitoring')}
            </Link>
          </div>
          <ThroughputChart traffic={traffic} />
        </article>

        <aside className={`${styles.panel} ${styles.providerPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.provider_activity', { defaultValue: 'Provider activity' })}
              </span>
              <h2>{providers.length.toLocaleString()}</h2>
            </div>
          </div>
          {providerTraffic.length > 0 ? (
            <ul className={styles.providerList}>
              {providerTraffic.map((provider) => (
                <li key={provider.id}>
                  <div className={styles.providerRowTop}>
                    <span>{providerLabel(provider.id, unknownProviderLabel)}</span>
                    <b>{provider.total.toLocaleString()}</b>
                  </div>
                  <Meter
                    value={provider.successRate}
                    ariaLabel={provider.id}
                    className={styles.providerMeter}
                  />
                  <div className={styles.providerRowMeta}>
                    <span>
                      {provider.credentials.toLocaleString()}{' '}
                      {t('dashboard.stat_credentials').toLowerCase()}
                    </span>
                    <span>
                      {t('stats.failure')} {provider.failure.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyNote}>{t('dashboard.traffic_unavailable_hint')}</p>
          )}
        </aside>
      </section>

      <section className={styles.detailGrid}>
        <article className={`${styles.panel} ${styles.usagePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.usage_eyebrow', { defaultValue: 'Local usage' })}
              </span>
              <h2>{t('dashboard.usage_title', { defaultValue: 'Today, from the local store' })}</h2>
            </div>
            <span className={styles.metaText}>{usageStatusText}</span>
          </div>

          {usage.issues.length > 0 && (
            <div className={styles.issueStrip}>
              <IconAlertTriangle size={16} />
              <span>
                {usage.issues[0]?.message ??
                  t('dashboard.usage_issue_fallback', {
                    defaultValue: 'Usage slice warning',
                  })}
              </span>
            </div>
          )}

          <div className={styles.usageStats}>
            <div className={styles.usageHero}>
              <span>{t('dashboard.today_requests', { defaultValue: 'Today requests' })}</span>
              <strong>{usageSummary ? formatHeadline(usageSummary.today.totalCalls) : DASH}</strong>
              {usageSummary && (
                <Meter
                  value={usageSummary.today.successRate}
                  tone={toneForSuccessRate(usageSummary.today.successRate)}
                  ariaLabel={t('dashboard.success_rate')}
                />
              )}
            </div>
            <dl>
              {todayUsageRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <dl>
              {tokenRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.twoColumnLists}>
            <div>
              <h3>{t('dashboard.usage_models_card', { defaultValue: 'Models today' })}</h3>
              {usageSummary && usageSummary.topModelsToday.length > 0 ? (
                <ul className={styles.compactList}>
                  {usageSummary.topModelsToday.slice(0, 5).map((model) => (
                    <li key={model.model}>
                      <span>{model.model || DASH}</span>
                      <b>{model.calls.toLocaleString()}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyNote}>
                  {t('dashboard.usage_models_empty', { defaultValue: 'No model usage today.' })}
                </p>
              )}
            </div>
            <div>
              <h3>{t('dashboard.usage_store_card', { defaultValue: 'Collector & store' })}</h3>
              {collectorRows.length > 0 ? (
                <dl className={styles.compactDefinition}>
                  {collectorRows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className={styles.emptyNote}>
                  {usage.loading ? t('common.loading') : t('dashboard.usage_no_summary')}
                </p>
              )}
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.healthPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.health_status', { defaultValue: 'Health status' })}
              </span>
              <h2>{issueCount.toLocaleString()}</h2>
            </div>
            <IconDatabaseZap size={22} />
          </div>
          <dl className={styles.compactDefinition}>
            <div>
              <dt>{t('dashboard.stat_credentials')}</dt>
              <dd>
                {credentials
                  ? `${credentials.active.toLocaleString()} / ${credentials.total.toLocaleString()}`
                  : authFilesLoading
                    ? t('common.loading')
                    : DASH}
              </dd>
            </div>
            <div>
              <dt>{t('stats.failure')}</dt>
              <dd>{traffic.totalFailure.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('dashboard.usage_store_dead_letters', { defaultValue: 'Dead letters' })}</dt>
              <dd>{usageStatus?.deadLetters.toLocaleString() ?? DASH}</dd>
            </div>
          </dl>
          {credentials && credentials.byType.length > 0 && (
            <ul className={styles.providerBreakdown}>
              {credentials.byType.slice(0, 7).map((entry) => (
                <li key={entry.type}>
                  <span>{providerLabel(entry.type, unknownProviderLabel)}</span>
                  <b>{entry.count.toLocaleString()}</b>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={`${styles.panel} ${styles.configPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.current_config_summary')}
              </span>
              <h2>{t('nav.config_management')}</h2>
            </div>
            <Link to="/config" className={styles.panelLink}>
              {t('dashboard.view_full_config')}
            </Link>
          </div>
          <dl className={styles.runtimeGrid}>
            {runtimeRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd
                  className={[
                    row.mono ? styles.monoValue : '',
                    row.tone === 'on' ? styles.onValue : '',
                    row.tone === 'off' ? styles.offValue : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className={`${styles.panel} ${styles.actionPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>
                {t('dashboard.provider_keys_detail', {
                  gemini: providerKeyCounts?.gemini ?? 0,
                  codex: providerKeyCounts?.codex ?? 0,
                  claude: providerKeyCounts?.claude ?? 0,
                  openai: providerKeyCounts?.openai ?? 0,
                })}
              </span>
              <h2>{t('dashboard.quick_actions', { defaultValue: 'Quick actions' })}</h2>
            </div>
          </div>
          {providerBreakdown.length > 0 && (
            <ul className={styles.providerBreakdown}>
              {providerBreakdown.map((entry) => (
                <li key={entry.id}>
                  <span>{providerLabel(entry.id, unknownProviderLabel)}</span>
                  <b>{entry.count.toLocaleString()}</b>
                </li>
              ))}
            </ul>
          )}
          <nav className={styles.actionList} aria-label={t('dashboard.quick_actions')}>
            {actions.map((action) => (
              <Link key={action.to} to={action.to}>
                <span className={styles.actionIcon}>{action.icon}</span>
                <span>
                  <b>{action.label}</b>
                  <small>{action.meta}</small>
                </span>
              </Link>
            ))}
          </nav>
        </article>
      </section>
    </div>
  );
}
