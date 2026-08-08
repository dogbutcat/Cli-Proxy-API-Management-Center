import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  captureQuotaCacheGeneration,
  commitIfQuotaCacheCurrent,
  useNotificationStore,
  useQuotaStore,
} from '@/stores';
import type { AuthFileItem } from '@/types';
import { getStatusFromError, resolveQuotaErrorMessage } from '@/utils/quota';
import { isRuntimeOnlyAuthFile, type QuotaProviderType } from '@/features/authFiles/constants';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import { bindQuotaClasses } from '@/features/quota/types';
import { QUOTA_ADAPTERS, type QuotaCardState } from '@/features/quota/providers';
import { buildQuotaFileEntry } from '@/features/quota/logic';
import quotaStyles from '@/features/quota/components/QuotaBody.module.scss';
import styles from './AuthFileQuota.module.scss';

/** 认证文件卡片外衣：紧凑额度样式绑定成类型化契约（缺键在模块初始化即抛）。 */
// Reuse quota-page elite badge style to avoid drift between hosts.
const compactQuotaClasses = bindQuotaClasses(
  {
    ...styles,
    elitePlanValue: quotaStyles.elitePlanValue,
  },
  'AuthFileQuota.module.scss'
);

const assertNever = (value: never): never => {
  throw new Error(`Unsupported quota type: ${value}`);
};

type QuotaMapUpdater = (
  updater: (prev: Record<string, QuotaCardState>) => Record<string, QuotaCardState>
) => void;

export type AuthFileQuotaSectionProps = {
  file: AuthFileItem;
  quotaType: QuotaProviderType;
  disableControls: boolean;
};

export function AuthFileQuotaSection(props: AuthFileQuotaSectionProps) {
  const { file, quotaType, disableControls } = props;
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const [resettingQuota, setResettingQuota] = useState(false);
  const adapter = QUOTA_ADAPTERS[quotaType];
  const entry = buildQuotaFileEntry(file, quotaType);
  const { cacheKey, displayName } = entry;

  const quota = useQuotaStore((state) => {
    if (quotaType === 'antigravity')
      return state.antigravityQuota[cacheKey] as QuotaCardState | undefined;
    if (quotaType === 'claude') return state.claudeQuota[cacheKey] as QuotaCardState | undefined;
    if (quotaType === 'codex') return state.codexQuota[cacheKey] as QuotaCardState | undefined;
    if (quotaType === 'opencode-go')
      return state.opencodeGoQuota[cacheKey] as QuotaCardState | undefined;
    if (quotaType === 'kimi') return state.kimiQuota[cacheKey] as QuotaCardState | undefined;
    if (quotaType === 'xai') return state.xaiQuota[cacheKey] as QuotaCardState | undefined;
    return assertNever(quotaType);
  });

  const updateQuotaState = useQuotaStore(
    (state) => state[adapter.storeSetter] as unknown as QuotaMapUpdater
  );

  const refreshQuotaForFile = useCallback(async () => {
    if (disableControls) return;
    if (isRuntimeOnlyAuthFile(file) && quotaType !== 'opencode-go') return;
    if (file.disabled) return;
    if (quota?.status === 'loading') return;

    const cacheGeneration = captureQuotaCacheGeneration();

    updateQuotaState((prev) => ({
      ...prev,
      [cacheKey]: adapter.buildLoadingState(),
    }));

    try {
      const data = await adapter.fetchQuota(file, t);
      commitIfQuotaCacheCurrent(cacheGeneration, () => {
        updateQuotaState((prev) => ({
          ...prev,
          [cacheKey]: adapter.buildSuccessState(data),
        }));
        showNotification(t('auth_files.quota_refresh_success', { name: displayName }), 'success');
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.unknown_error');
      const status = getStatusFromError(err);
      commitIfQuotaCacheCurrent(cacheGeneration, () => {
        updateQuotaState((prev) => ({
          ...prev,
          [cacheKey]: adapter.buildErrorState(message, status),
        }));
        showNotification(
          t('auth_files.quota_refresh_failed', { name: displayName, message }),
          'error'
        );
      });
    }
  }, [
    adapter,
    cacheKey,
    disableControls,
    displayName,
    file,
    quota?.status,
    quotaType,
    showNotification,
    t,
    updateQuotaState,
  ]);

  const resetQuotaForFile = useCallback(() => {
    if (disableControls) return;
    if (isRuntimeOnlyAuthFile(file)) return;
    if (file.disabled) return;
    if (quota?.status === 'loading') return;
    if (resettingQuota) return;

    const resetQuota = adapter.resetQuota;
    if (!resetQuota) return;

    showConfirmation({
      title: t('codex_quota.reset_confirm_title'),
      message: t('codex_quota.reset_confirm_message', { name: displayName }),
      confirmText: t('codex_quota.reset_confirm_button'),
      variant: 'primary',
      onConfirm: async () => {
        const cacheGeneration = captureQuotaCacheGeneration();
        setResettingQuota(true);
        try {
          const data = await resetQuota(file, t);
          commitIfQuotaCacheCurrent(cacheGeneration, () => {
            updateQuotaState((prev) => ({
              ...prev,
              [cacheKey]: adapter.buildSuccessState(data),
            }));
            showNotification(t('codex_quota.reset_success', { name: displayName }), 'success');
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t('common.unknown_error');
          commitIfQuotaCacheCurrent(cacheGeneration, () => {
            showNotification(
              t('codex_quota.reset_failed', { name: displayName, message }),
              'error'
            );
          });
        } finally {
          setResettingQuota(false);
        }
      },
    });
  }, [
    adapter,
    cacheKey,
    disableControls,
    displayName,
    file,
    quota?.status,
    resettingQuota,
    showConfirmation,
    showNotification,
    t,
    updateQuotaState,
  ]);

  const quotaStatus = quota?.status ?? 'idle';
  const canRefreshQuota = !disableControls && !file.disabled && !resettingQuota;
  const canUseResetQuota = canRefreshQuota && quotaStatus !== 'loading';
  const refreshQuotaAction =
    quotaType === 'opencode-go' && quotaStatus !== 'idle' ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={styles.quotaResetCreditButton}
        onClick={() => void refreshQuotaForFile()}
        disabled={!canRefreshQuota || quotaStatus === 'loading'}
        loading={quotaStatus === 'loading'}
        title={t('auth_files.quota_refresh_hint')}
        aria-label={t('auth_files.quota_refresh_single')}
      >
        {quotaStatus !== 'loading' && <IconRefreshCw size={14} />}
        {t('auth_files.quota_refresh_single')}
      </Button>
    ) : undefined;
  const showResetQuotaAction = quota !== undefined && Boolean(adapter.canResetQuota?.(quota));
  const resetQuotaAction =
    adapter.resetQuota && showResetQuotaAction ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={styles.quotaResetCreditButton}
        onClick={() => resetQuotaForFile()}
        disabled={!canUseResetQuota}
        loading={resettingQuota}
        title={t('codex_quota.reset_button')}
        aria-label={t('codex_quota.reset_button')}
      >
        {!resettingQuota && <IconRefreshCw size={14} />}
        {t('codex_quota.reset_button')}
      </Button>
    ) : undefined;
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );

  return (
    <div className={styles.quotaSection}>
      {quotaStatus === 'loading' ? (
        <div className={styles.quotaMessage}>{t(`${adapter.i18nPrefix}.loading`)}</div>
      ) : quotaStatus === 'idle' ? (
        <button
          type="button"
          className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
          onClick={() => void refreshQuotaForFile()}
          disabled={!canRefreshQuota}
        >
          {t(`${adapter.i18nPrefix}.idle`)}
        </button>
      ) : quotaStatus === 'error' ? (
        <div className={styles.quotaError}>
          {t(`${adapter.i18nPrefix}.load_failed`, {
            message: quotaErrorMessage,
          })}
        </div>
      ) : quota ? (
        <adapter.Body quota={quota} classes={compactQuotaClasses} />
      ) : (
        <div className={styles.quotaMessage}>{t(`${adapter.i18nPrefix}.idle`)}</div>
      )}
      {(refreshQuotaAction || resetQuotaAction) && (
        <div className={styles.quotaCardActions}>
          {resetQuotaAction}
          {refreshQuotaAction}
        </div>
      )}
    </div>
  );
}
