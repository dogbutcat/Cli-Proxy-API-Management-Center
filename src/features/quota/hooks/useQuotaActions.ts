/**
 * 单卡额度操作：刷新 + Codex 重置积分。
 * 流程 1:1 移植旧 QuotaSection（confirm modal、resetting 再入守卫、
 * generation-guarded commit、成功/失败通知），仅把 config 换成 adapter。
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  captureQuotaCacheGeneration,
  commitIfQuotaCacheCurrent,
  useNotificationStore,
} from '@/stores';
import { getStatusFromError } from '@/utils/quota';
import type { QuotaFileEntry } from '../logic';
import { getQuotaMap, getQuotaSetter, type QuotaAdapter, type QuotaCardState } from '../providers';

const getQuotaState = (adapter: QuotaAdapter, name: string): QuotaCardState | undefined =>
  getQuotaMap(adapter)[name];

export function useQuotaActions(disableControls: boolean) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const [resettingQuotaKey, setResettingQuotaKey] = useState<string | null>(null);

  const refreshQuota = useCallback(
    async (entry: QuotaFileEntry, adapter: QuotaAdapter) => {
      const { file, cacheKey, displayName } = entry;
      if (disableControls || file.disabled) return;
      if (resettingQuotaKey === cacheKey) return;
      if (getQuotaState(adapter, cacheKey)?.status === 'loading') return;
      const cacheGeneration = captureQuotaCacheGeneration();
      const setQuota = getQuotaSetter(adapter);

      setQuota((prev) => ({
        ...prev,
        [cacheKey]: adapter.buildLoadingState(),
      }));

      try {
        const data = await adapter.fetchQuota(file, t);
        commitIfQuotaCacheCurrent(cacheGeneration, () => {
          setQuota((prev) => ({
            ...prev,
            [cacheKey]: adapter.buildSuccessState(data),
          }));
          showNotification(t('auth_files.quota_refresh_success', { name: displayName }), 'success');
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.unknown_error');
        const status = getStatusFromError(err);
        commitIfQuotaCacheCurrent(cacheGeneration, () => {
          setQuota((prev) => ({
            ...prev,
            [cacheKey]: adapter.buildErrorState(message, status),
          }));
          showNotification(
            t('auth_files.quota_refresh_failed', { name: displayName, message }),
            'error'
          );
        });
      }
    },
    [disableControls, resettingQuotaKey, showNotification, t]
  );

  const resetQuota = useCallback(
    (entry: QuotaFileEntry, adapter: QuotaAdapter) => {
      const { file, cacheKey, displayName } = entry;
      const resetQuotaFn = adapter.resetQuota;
      if (!resetQuotaFn) return;
      if (disableControls || file.disabled) return;
      if (getQuotaState(adapter, cacheKey)?.status === 'loading') return;
      if (resettingQuotaKey === cacheKey) return;

      showConfirmation({
        title: t('codex_quota.reset_confirm_title'),
        message: t('codex_quota.reset_confirm_message', { name: displayName }),
        confirmText: t('codex_quota.reset_confirm_button'),
        variant: 'primary',
        onConfirm: async () => {
          const cacheGeneration = captureQuotaCacheGeneration();
          const setQuota = getQuotaSetter(adapter);
          setResettingQuotaKey(cacheKey);
          try {
            const data = await resetQuotaFn(file, t);
            commitIfQuotaCacheCurrent(cacheGeneration, () => {
              setQuota((prev) => ({
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
            setResettingQuotaKey((current) => (current === cacheKey ? null : current));
          }
        },
      });
    },
    [disableControls, resettingQuotaKey, showConfirmation, showNotification, t]
  );

  return { resettingQuotaKey, refreshQuota, resetQuota };
}
