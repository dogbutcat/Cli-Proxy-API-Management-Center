import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconBot,
  IconFileText,
  IconSidebarConfig,
  IconSidebarLogs,
  IconSidebarQuota,
  IconSidebarSystem,
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
import { useDashboardOverview } from './hooks/useDashboardOverview';
import { LiveWire } from './components/LiveWire';
import { Meter } from './components/Meter';
import { Sparkline } from './components/Sparkline';
import { ThroughputChart } from './components/ThroughputChart';
import { useCountUp, useRevealGroup, useRevealOnScroll } from '@/hooks/motion';
import { providerLabel, splitWindowMinutes, toneForSuccessRate, type MeterTone } from './utils';
import styles from './dashboard.module.scss';

const DASH = '—';

/** KPI accent strip: semantic tiles use state colors, neutral tiles stay quiet. */
const TILE_ACCENTS: Record<MeterTone, string> = {
  good: 'var(--viz-success)',
  warning: 'var(--amber-color)',
  critical: 'var(--viz-failure)',
  idle: 'var(--text-quaternary)',
};

/** Large figures use grouped digits below six places, then compact to avoid overflow. */
const formatHeadline = (value: number): string =>
  value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);

  const {
    connectionStatus,
    connected,
    config,
    counts,
    traffic,
    providers,
    credentials,
    usage,
    refresh,
  } = useDashboardOverview();

  useHeaderRefresh(refresh, connected);

  /* Hero/static grids reveal as groups; async chart/provider sections reveal as whole blocks. */
  const heroRef = useRevealGroup<HTMLElement>();
  const statsRef = useRevealGroup<HTMLElement>(0.12);
  const usageRef = useRevealGroup<HTMLElement>();
  const trafficRef = useRevealOnScroll<HTMLElement>();
  const fleetRef = useRevealOnScroll<HTMLElement>();
  const detailRef = useRevealGroup<HTMLElement>();
  const ctaRef = useRevealGroup<HTMLElement>();

  const animatedTotal = useCountUp(traffic.total, connected);

  const windowLabel = useMemo(() => {
    if (traffic.windowMinutes <= 0) return DASH;
    const { hours, minutes } = splitWindowMinutes(traffic.windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);

  const heroSparkPoints = useMemo(
    () => traffic.buckets.map((bucket) => bucket.success + bucket.failed),
    [traffic.buckets]
  );

  const routingStrategy = useMemo(() => {
    const raw = config?.routingStrategy?.trim() ?? '';
    if (!raw) return DASH;
    if (raw === 'round-robin') return t('basic_settings.routing_strategy_round_robin');
    if (raw === 'weighted-round-robin') {
      return t('basic_settings.routing_strategy_weighted_round_robin');
    }
    if (raw === 'fill-first') return t('basic_settings.routing_strategy_fill_first');
    return raw;
  }, [config?.routingStrategy, t]);

  const unknownProviderLabel = t('dashboard.provider_unknown');
  const successRateTone = toneForSuccessRate(traffic.successRate);
  const usageSummary = usage.summary;
  const usageStatus = usage.status;
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
  const usageStatusTone: MeterTone =
    usage.summaryState === 'error' || usage.statusState === 'error'
      ? 'critical'
      : usage.partial || usage.stale
        ? 'warning'
        : usage.summaryState === 'ok' || usage.statusState === 'ok'
          ? 'good'
          : 'idle';

  /** The title is a computed verdict, with the trailing period acting as the status light. */
  const verdict = useMemo(() => {
    if (!connected) {
      return connectionStatus === 'connecting'
        ? { key: 'hero_verdict_connecting', accent: 'var(--amber-color)' }
        : { key: 'hero_verdict_offline', accent: 'var(--text-quaternary)' };
    }
    if (traffic.total === 0 || traffic.successRate === null) {
      return { key: 'hero_verdict_idle', accent: 'var(--text-quaternary)' };
    }
    const keyByTone: Record<MeterTone, string> = {
      good: 'hero_verdict_good',
      warning: 'hero_verdict_warning',
      critical: 'hero_verdict_critical',
      idle: 'hero_verdict_idle',
    };
    return { key: keyByTone[successRateTone], accent: TILE_ACCENTS[successRateTone] };
  }, [connected, connectionStatus, traffic.total, traffic.successRate, successRateTone]);

  /* The period breathes only when traffic is alive; offline/quiet states stay still. */
  const heroAlive = connected && traffic.total > 0;

  const connectionLabel = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );
  const versionLabel = serverVersion ? `v${serverVersion.trim().replace(/^[vV]+/, '')}` : null;
  const heroMetaLine = [versionLabel, connectionLabel].filter(Boolean).join(' · ');

  const statTiles = [
    {
      key: 'success',
      label: t('dashboard.success_rate'),
      value: traffic.successRate === null ? DASH : formatPercent(traffic.successRate),
      hint: t('dashboard.stat_success_hint', { total: traffic.total.toLocaleString() }),
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
      meter:
        credentials && credentials.total > 0
          ? (credentials.active / credentials.total) * 100
          : null,
      tone: undefined,
    },
    {
      key: 'providerKeys',
      label: t('dashboard.stat_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
      hint: t('dashboard.stat_provider_keys_hint'),
      meter: null,
      tone: undefined,
    },
    {
      key: 'models',
      label: t('dashboard.stat_models'),
      value: counts.models === null ? DASH : counts.models.toLocaleString(),
      hint: t('dashboard.stat_models_hint'),
      meter: null,
      tone: undefined,
    },
  ];

  const runtimeRows: Array<{ label: string; value: string; mono?: boolean }> = [
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
  ];

  const runtimeToggles = config
    ? [
        { label: t('dashboard.runtime_debug'), on: Boolean(config.debug) },
        { label: t('dashboard.runtime_file_logging'), on: Boolean(config.loggingToFile) },
        { label: t('dashboard.runtime_request_log'), on: Boolean(config.requestLog) },
        { label: t('dashboard.runtime_ws_auth'), on: Boolean(config.wsAuth) },
        { label: t('dashboard.runtime_model_prefix'), on: Boolean(config.forceModelPrefix) },
      ]
    : [];

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

  const ctaCards = [
    {
      to: '/ai-providers',
      icon: <IconBot size={20} />,
      title: t('nav.ai_providers'),
      description: t('dashboard.cta_providers_desc'),
    },
    {
      to: '/auth-files',
      icon: <IconFileText size={20} />,
      title: t('nav.auth_files'),
      description: t('dashboard.cta_auth_files_desc'),
    },
    {
      to: '/config',
      icon: <IconSidebarConfig size={20} />,
      title: t('nav.config_management'),
      description: t('dashboard.cta_config_desc'),
    },
    {
      to: '/quota',
      icon: <IconSidebarQuota size={20} />,
      title: t('nav.quota_management'),
      description: t('dashboard.cta_quota_desc'),
    },
    {
      to: '/logs',
      icon: <IconSidebarLogs size={20} />,
      title: t('nav.logs'),
      description: t('dashboard.cta_logs_desc'),
    },
    {
      to: '/system',
      icon: <IconSidebarSystem size={20} />,
      title: t('nav.system_info'),
      description: t('dashboard.cta_system_desc'),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.washTop} />
        <span className={styles.gridWash} />
      </div>

      {/* ---------- Hero ---------- */}
      <section className={styles.hero} ref={heroRef}>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle} data-reveal>
            {t(`dashboard.${verdict.key}`)}
            <span
              className={`${styles.heroPeriod} ${heroAlive ? styles.heroPeriodLive : ''}`}
              style={{ color: verdict.accent }}
            >
              {t('dashboard.hero_period')}
            </span>
          </h1>
          <p className={styles.heroMeta} data-reveal>
            {heroMetaLine}
          </p>
          <div className={styles.heroActions} data-reveal>
            <Link to="/ai-providers" className={styles.primaryAction}>
              {t('dashboard.cta_manage_providers')}
            </Link>
            <Link to="/logs" className={styles.ghostAction}>
              {t('dashboard.cta_inspect_logs')}{' '}
              <span className={styles.linkArrow} aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel} data-reveal="scale">
          <div className={styles.heroPanelTop}>
            <span className={styles.heroPanelLabel}>{t('dashboard.hero_requests_label')}</span>
            {connected && (
              <span className={styles.liveBadge}>
                <i className={styles.liveDot} aria-hidden="true" />
                {t('dashboard.hero_live')}
              </span>
            )}
          </div>
          <strong className={styles.heroFigure}>
            {connected ? formatHeadline(animatedTotal) : DASH}
          </strong>
          <span className={styles.heroPanelMeta}>
            {t('dashboard.hero_window_meta', { window: windowLabel })}
          </span>
          {traffic.total > 0 && (
            <div className={styles.ratioBar} aria-hidden="true">
              {traffic.totalSuccess > 0 && (
                <span
                  className={`${styles.ratioSegment} ${styles.splitSuccess}`}
                  style={{ flexGrow: traffic.totalSuccess }}
                />
              )}
              {traffic.totalFailure > 0 && (
                <span
                  className={`${styles.ratioSegment} ${styles.splitFailure}`}
                  style={{ flexGrow: traffic.totalFailure }}
                />
              )}
            </div>
          )}
          <div className={styles.heroSplit}>
            <span className={styles.heroSplitItem}>
              <i className={`${styles.splitSwatch} ${styles.splitSuccess}`} aria-hidden="true" />
              {t('stats.success')}
              <b>{traffic.totalSuccess.toLocaleString()}</b>
            </span>
            <span className={styles.heroSplitItem}>
              <i className={`${styles.splitSwatch} ${styles.splitFailure}`} aria-hidden="true" />
              {t('stats.failure')}
              <b>{traffic.totalFailure.toLocaleString()}</b>
            </span>
          </div>
        </div>

        <div className={styles.heroWire}>
          <LiveWire
            points={heroSparkPoints}
            ariaLabel={t('dashboard.hero_spark_label', { window: windowLabel })}
          />
        </div>
      </section>

      {/* ---------- KPI ---------- */}
      <section className={styles.statsRow} ref={statsRef} aria-label={t('dashboard.stats_aria')}>
        {statTiles.map((tile) => (
          <article
            key={tile.key}
            className={styles.statTile}
            data-reveal
            style={
              {
                '--tile-accent': tile.tone ? TILE_ACCENTS[tile.tone] : 'var(--border-hover)',
              } as React.CSSProperties
            }
          >
            <span className={styles.statLabel}>{tile.label}</span>
            <strong className={styles.statValue}>{tile.value}</strong>
            {tile.meter !== null && tile.meter !== undefined && (
              <Meter
                value={tile.meter}
                tone={tile.tone}
                ariaLabel={tile.label}
                className={styles.statMeter}
              />
            )}
            <span className={styles.statHint}>{tile.hint}</span>
          </article>
        ))}
      </section>

      {/* ---------- Local usage summary ---------- */}
      <section className={styles.section} ref={usageRef}>
        <header className={styles.sectionHead} data-reveal>
          <span className={styles.eyebrow}>
            {t('dashboard.usage_eyebrow', { defaultValue: 'Local usage' })}
          </span>
          <h2 className={styles.sectionTitle}>
            {t('dashboard.usage_title', { defaultValue: 'Today, from the local store' })}
          </h2>
          <p className={styles.sectionDescription}>{usageStatusText}</p>
        </header>

        {usage.issues.length > 0 && (
          <div className={styles.usageIssueStrip} data-reveal>
            {usage.issues.slice(0, 2).map((issue, index) => (
              <span key={`${issue.source}-${issue.kind ?? 'issue'}-${index}`}>
                {issue.message ??
                  t('dashboard.usage_issue_fallback', { defaultValue: 'Usage slice warning' })}
              </span>
            ))}
          </div>
        )}

        <div className={styles.usageGrid}>
          <article className={styles.usageCard} data-reveal>
            <header className={styles.usageCardHead}>
              <span className={styles.usageCardLabel}>
                {t('dashboard.usage_summary_card', { defaultValue: 'Summary' })}
              </span>
              <i
                className={`${styles.usageStateDot} ${styles[`usageState_${usageStatusTone}`]}`}
                aria-hidden="true"
              />
            </header>
            <strong className={styles.usageFigure}>
              {usageSummary ? formatHeadline(usageSummary.today.totalCalls) : DASH}
            </strong>
            <span className={styles.usageFigureHint}>
              {usageSummary
                ? t('dashboard.usage_rolling_meta', {
                    defaultValue: '{{rpm}} RPM · {{tpm}} TPM over 30m',
                    rpm: usageSummary.rolling30m.rpm.toLocaleString(),
                    tpm: usageSummary.rolling30m.tpm.toLocaleString(),
                  })
                : t('dashboard.usage_no_summary', { defaultValue: 'No summary loaded' })}
            </span>
            {usageSummary && (
              <Meter
                value={usageSummary.today.successRate}
                tone={toneForSuccessRate(usageSummary.today.successRate)}
                ariaLabel={t('dashboard.success_rate')}
                className={styles.usageMeter}
              />
            )}
            <dl className={styles.usageMetricGrid}>
              {todayUsageRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className={styles.usageCard} data-reveal>
            <header className={styles.usageCardHead}>
              <span className={styles.usageCardLabel}>
                {t('dashboard.usage_tokens_card', { defaultValue: 'Tokens' })}
              </span>
              <span className={styles.usagePill}>
                {usageSummary ? formatCompactNumber(usageSummary.today.zeroTokenCalls) : DASH}{' '}
                {t('dashboard.usage_zero_token_calls', { defaultValue: 'zero-token' })}
              </span>
            </header>
            <strong className={styles.usageFigure}>
              {usageSummary ? formatHeadline(usageSummary.today.totalTokens) : DASH}
            </strong>
            <span className={styles.usageFigureHint}>
              {t('dashboard.usage_tokens_hint', {
                defaultValue: 'Prompt, output, cache, reasoning',
              })}
            </span>
            <dl className={styles.usageMetricGrid}>
              {tokenRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className={styles.usageCard} data-reveal>
            <header className={styles.usageCardHead}>
              <span className={styles.usageCardLabel}>
                {t('dashboard.usage_models_card', { defaultValue: 'Models today' })}
              </span>
            </header>
            {usageSummary && usageSummary.topModelsToday.length > 0 ? (
              <ul className={styles.usageList}>
                {usageSummary.topModelsToday.map((model) => (
                  <li key={model.model}>
                    <span className={styles.usageListMain}>{model.model || DASH}</span>
                    <span className={styles.usageListMeta}>
                      {model.calls.toLocaleString()} · {formatCompactNumber(model.tokens)} ·{' '}
                      {formatPercent(model.successRate)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>
                {t('dashboard.usage_models_empty', { defaultValue: 'No model usage today.' })}
              </p>
            )}
          </article>

          <article className={styles.usageCard} data-reveal>
            <header className={styles.usageCardHead}>
              <span className={styles.usageCardLabel}>
                {t('dashboard.usage_failures_card', { defaultValue: 'Recent failures' })}
              </span>
            </header>
            {usageSummary && usageSummary.recentFailures.length > 0 ? (
              <ul className={styles.usageList}>
                {usageSummary.recentFailures.map((failure) => (
                  <li key={failure.eventHash || failure.requestId || failure.timestampMs}>
                    <span className={styles.usageListMain}>
                      {failure.model || failure.provider || DASH}
                    </span>
                    <span className={styles.usageListMeta}>
                      {failure.failStatusCode ?? DASH} ·{' '}
                      {failure.failSummary ??
                        t('dashboard.usage_failure_fallback', { defaultValue: 'Request failed' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>
                {t('dashboard.usage_failures_empty', { defaultValue: 'No recent failures.' })}
              </p>
            )}
          </article>

          <article className={styles.usageCard} data-reveal>
            <header className={styles.usageCardHead}>
              <span className={styles.usageCardLabel}>
                {t('dashboard.usage_store_card', { defaultValue: 'Collector & store' })}
              </span>
              <span className={styles.usagePill}>
                {usageStatus?.source ?? usageStatus?.service ?? DASH}
              </span>
            </header>
            <dl className={styles.usageMetricGrid}>
              {collectorRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {usageStatus?.collector && (
              <p className={styles.usageFigureHint}>
                {t('dashboard.usage_collector_meta', {
                  defaultValue: '{{inserted}} inserted · {{dropped}} dropped · {{skipped}} skipped',
                  inserted: usageStatus.collector.totalInserted.toLocaleString(),
                  dropped: usageStatus.collector.totalDropped.toLocaleString(),
                  skipped: usageStatus.collector.totalSkipped.toLocaleString(),
                })}
              </p>
            )}
            {usageStatus?.collector?.lastError && (
              <p className={styles.usageErrorText}>{usageStatus.collector.lastError}</p>
            )}
          </article>
        </div>
      </section>

      {/* ---------- Traffic ---------- */}
      <section className={styles.section} ref={trafficRef}>
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('dashboard.traffic_eyebrow')}</span>
          <h2 className={styles.sectionTitle}>{t('dashboard.traffic_title')}</h2>
          <p className={styles.sectionDescription}>
            {t('dashboard.traffic_description', { window: windowLabel })}
          </p>
        </header>
        <div className={styles.panel}>
          <ThroughputChart traffic={traffic} />
        </div>
      </section>

      {/* ---------- Provider fleet ---------- */}
      <section className={styles.section} ref={fleetRef}>
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>{t('dashboard.fleet_eyebrow')}</span>
          <h2 className={styles.sectionTitle}>{t('dashboard.fleet_title')}</h2>
          <p className={styles.sectionDescription}>{t('dashboard.fleet_description')}</p>
        </header>
        <div className={styles.panel}>
          {providers.length === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.fleet_empty')}</p>
          ) : (
            <ul className={styles.fleetList}>
              {providers.map((provider, index) => (
                <li key={provider.id} className={styles.fleetRow}>
                  <span className={styles.fleetRank} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.fleetIdentity}>
                    <span className={styles.fleetName}>
                      {providerLabel(provider.id, unknownProviderLabel)}
                    </span>
                    <span className={styles.fleetMeta}>
                      {t('dashboard.fleet_credentials', { value: provider.credentials })}
                    </span>
                  </div>
                  <Sparkline
                    points={provider.buckets.map((bucket) => bucket.success + bucket.failed)}
                    ariaLabel={t('dashboard.fleet_spark_label', {
                      provider: providerLabel(provider.id, unknownProviderLabel),
                    })}
                    className={styles.fleetSpark}
                  />
                  <div className={styles.fleetNumbers}>
                    <span className={styles.fleetTotal}>{provider.total.toLocaleString()}</span>
                    <span className={styles.fleetTotalLabel}>{t('dashboard.fleet_requests')}</span>
                  </div>
                  <div className={styles.fleetRate}>
                    <span className={styles.fleetRateValue}>
                      {provider.successRate === null ? DASH : formatPercent(provider.successRate)}
                    </span>
                    <Meter
                      value={provider.successRate}
                      ariaLabel={t('dashboard.success_rate')}
                      className={styles.fleetMeter}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------- Credential health + runtime ---------- */}
      <section className={styles.detailGrid} ref={detailRef}>
        <div className={styles.panel} data-reveal>
          <header className={styles.panelHead}>
            <span className={styles.eyebrow}>{t('dashboard.health_eyebrow')}</span>
            <h2 className={styles.panelTitle}>{t('dashboard.health_title')}</h2>
          </header>
          {!credentials || credentials.total === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.health_empty')}</p>
          ) : (
            <>
              <div className={styles.healthBar}>
                {credentials.active > 0 && (
                  <span
                    className={`${styles.healthSegment} ${styles.healthActive}`}
                    style={{ flexGrow: credentials.active }}
                  />
                )}
                {credentials.unavailable > 0 && (
                  <span
                    className={`${styles.healthSegment} ${styles.healthUnavailable}`}
                    style={{ flexGrow: credentials.unavailable }}
                  />
                )}
                {credentials.disabled > 0 && (
                  <span
                    className={`${styles.healthSegment} ${styles.healthDisabled}`}
                    style={{ flexGrow: credentials.disabled }}
                  />
                )}
              </div>
              <ul className={styles.healthLegend}>
                <li>
                  <i className={`${styles.healthKey} ${styles.healthActive}`} aria-hidden="true" />
                  {t('dashboard.health_active')}
                  <b>{credentials.active.toLocaleString()}</b>
                </li>
                <li>
                  <i
                    className={`${styles.healthKey} ${styles.healthUnavailable}`}
                    aria-hidden="true"
                  />
                  {t('dashboard.health_unavailable')}
                  <b>{credentials.unavailable.toLocaleString()}</b>
                </li>
                <li>
                  <i
                    className={`${styles.healthKey} ${styles.healthDisabled}`}
                    aria-hidden="true"
                  />
                  {t('dashboard.health_disabled')}
                  <b>{credentials.disabled.toLocaleString()}</b>
                </li>
              </ul>
              <div className={styles.typeBreakdown}>
                <span className={styles.typeBreakdownLabel}>{t('dashboard.health_by_type')}</span>
                <ul className={styles.typeList}>
                  {credentials.byType.map((entry) => (
                    <li key={entry.type} className={styles.typeChip}>
                      {providerLabel(entry.type, unknownProviderLabel)}
                      <b>{entry.count.toLocaleString()}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/auth-files" className={styles.panelLink}>
                {t('dashboard.health_link')}{' '}
                <span className={styles.linkArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </>
          )}
        </div>

        <div className={styles.panel} data-reveal>
          <header className={styles.panelHead}>
            <span className={styles.eyebrow}>{t('dashboard.runtime_eyebrow')}</span>
            <h2 className={styles.panelTitle}>{t('dashboard.runtime_title')}</h2>
          </header>
          <dl className={styles.specList}>
            {runtimeRows.map((row) => (
              <div key={row.label} className={styles.specRow}>
                <dt className={styles.specLabel}>{row.label}</dt>
                <dd className={`${styles.specValue} ${row.mono ? styles.specMono : ''}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          {runtimeToggles.length > 0 && (
            <ul className={styles.toggleList}>
              {runtimeToggles.map((toggle) => (
                <li
                  key={toggle.label}
                  className={`${styles.togglePill} ${toggle.on ? styles.toggleOn : styles.toggleOff}`}
                >
                  {toggle.label}
                  <b>{toggle.on ? t('common.yes') : t('common.no')}</b>
                </li>
              ))}
            </ul>
          )}
          <Link to="/config" className={styles.panelLink}>
            {t('dashboard.runtime_link')}{' '}
            <span className={styles.linkArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className={styles.section} ref={ctaRef}>
        <header className={styles.sectionHead} data-reveal>
          <span className={styles.eyebrow}>{t('dashboard.cta_eyebrow')}</span>
          <h2 className={styles.sectionTitle}>{t('dashboard.cta_title')}</h2>
        </header>
        <div className={styles.ctaGrid}>
          {ctaCards.map((card) => (
            <Link key={card.to} to={card.to} className={styles.ctaCard} data-reveal>
              <span className={styles.ctaIcon}>{card.icon}</span>
              <span className={styles.ctaTitle}>{card.title}</span>
              <span className={styles.ctaDescription}>{card.description}</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
