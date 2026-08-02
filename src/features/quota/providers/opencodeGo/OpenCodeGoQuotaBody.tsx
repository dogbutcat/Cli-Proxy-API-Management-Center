import { useTranslation } from 'react-i18next';
import type { OpenCodeGoQuotaState } from '@/types';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaBodyProps } from '../../types';

export function OpenCodeGoQuotaBody({ quota, classes }: QuotaBodyProps<OpenCodeGoQuotaState>) {
  const { t } = useTranslation();
  const windows = quota.windows ?? [];

  return (
    <>
      <div className={classes.codexPlan}>
        <span className={classes.codexPlanItem}>
          <span className={classes.codexPlanLabel}>
            {t('opencode_go_quota.identity_label', { defaultValue: 'Workspace' })}
          </span>
          <span className={classes.codexPlanValue}>
            {quota.identity?.label ||
              quota.identity?.workspace ||
              quota.identity?.identityKey ||
              '-'}
          </span>
        </span>
        {quota.diagnostic && (
          <span className={classes.codexPlanItem}>
            <span className={classes.codexPlanLabel}>
              {t('opencode_go_quota.diagnostic_label', { defaultValue: 'Status' })}
            </span>
            <span className={classes.codexPlanValue}>{quota.diagnostic}</span>
          </span>
        )}
      </div>

      {quota.referralCode || quota.referralUrl ? (
        <div className={classes.codexResetCredits}>
          <div className={classes.codexResetCreditsTitle}>
            {t('opencode_go_quota.referral_title', { defaultValue: 'Referral preview' })}
          </div>
          {quota.referralCode && (
            <div className={classes.codexResetCreditRow}>
              <span className={classes.codexResetCreditLabel}>
                {t('opencode_go_quota.referral_code', { defaultValue: 'Code' })}
              </span>
              <span className={classes.codexResetCreditTime}>{quota.referralCode}</span>
            </div>
          )}
          {quota.referralUrl && (
            <div className={classes.codexResetCreditRow}>
              <span className={classes.codexResetCreditLabel}>
                {t('opencode_go_quota.referral_url', { defaultValue: 'URL' })}
              </span>
              <span className={classes.codexResetCreditTime}>{quota.referralUrl}</span>
            </div>
          )}
        </div>
      ) : quota.referralError ? (
        <div className={classes.codexResetCreditsError}>
          {t('opencode_go_quota.referral_failed', {
            message: quota.referralError,
            defaultValue: 'Referral preview unavailable: {{message}}',
          })}
        </div>
      ) : null}

      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>
          {t('opencode_go_quota.empty_windows', { defaultValue: 'No quota windows reported' })}
        </div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const clampedUsed = used === null ? null : Math.max(0, Math.min(100, used));
          const remaining =
            clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
          const percentLabel = remaining === null ? '--' : `${Math.round(remaining)}%`;

          return (
            <div key={window.id || `${window.label}-${index}`} className={classes.quotaRow}>
              <div className={classes.quotaRowHeader}>
                <span className={classes.quotaModel}>{window.label}</span>
                <span className={classes.quotaMeta}>
                  <span className={classes.quotaPercent}>{percentLabel}</span>
                  <span className={classes.quotaReset}>{window.resetLabel || '-'}</span>
                </span>
              </div>
              <QuotaMeter percent={remaining} classes={classes} index={index} />
            </div>
          );
        })
      )}
    </>
  );
}
