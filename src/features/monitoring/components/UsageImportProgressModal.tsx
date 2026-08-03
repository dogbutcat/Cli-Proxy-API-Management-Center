import type { TFunction } from 'i18next';
import { Modal } from '@/components/ui/Modal';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconFileText,
  IconLoader2,
  IconRefreshCw,
  IconTrash2,
} from '@/components/ui/icons';
import { formatFileSize } from '@/utils/format';
import type {
  UsageImportUploadDecision,
  UsageImportUploadProgress,
} from '@/features/monitoring/services/usageImportSession';
import styles from '../MonitoringCenterPage.module.scss';

export type UsageImportProgressStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'success'
  | 'error';

type UsageImportProgressModalProps = {
  open: boolean;
  file: File | null;
  decision: UsageImportUploadDecision | null;
  status: UsageImportProgressStatus;
  progress: UsageImportUploadProgress | null;
  error: string;
  t: TFunction;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
};

const fallbackText = (t: TFunction, key: string, fallback: string, values?: object) => {
  const label = t(key, { defaultValue: fallback, ...(values ?? {}) });
  return label === key ? fallback : label;
};

const formatPercent = (uploadedBytes: number, totalBytes: number): number => {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
};

const describePhase = (
  t: TFunction,
  status: UsageImportProgressStatus,
  progress: UsageImportUploadProgress | null
) => {
  if (status === 'paused') {
    return fallbackText(t, 'usage_stats.import_progress_paused', 'Paused');
  }
  if (status === 'cancelling') {
    return fallbackText(t, 'usage_stats.import_progress_cancelling', 'Cancelling');
  }
  if (status === 'cancelled') {
    return fallbackText(t, 'usage_stats.import_progress_cancelled', 'Cancelled');
  }
  if (status === 'success') {
    return fallbackText(t, 'usage_stats.import_progress_success', 'Completed');
  }
  if (status === 'error') {
    return fallbackText(t, 'usage_stats.import_progress_error', 'Failed');
  }

  switch (progress?.phase) {
    case 'creating':
      return fallbackText(t, 'usage_stats.import_progress_creating', 'Creating session');
    case 'resuming':
      return fallbackText(t, 'usage_stats.import_progress_resuming', 'Resuming upload');
    case 'uploading':
      return fallbackText(t, 'usage_stats.import_progress_uploading', 'Uploading');
    case 'completing':
      return fallbackText(t, 'usage_stats.import_progress_completing', 'Importing');
    case 'completed':
      return fallbackText(t, 'usage_stats.import_progress_success', 'Completed');
    case 'cancelled':
      return fallbackText(t, 'usage_stats.import_progress_cancelled', 'Cancelled');
    default:
      return fallbackText(t, 'usage_stats.import_progress_waiting', 'Waiting');
  }
};

export function UsageImportProgressModal({
  open,
  file,
  decision,
  status,
  progress,
  error,
  t,
  onPause,
  onResume,
  onCancel,
  onClose,
}: UsageImportProgressModalProps) {
  const uploadedBytes = progress?.uploadedBytes ?? 0;
  const totalBytes = progress?.totalBytes ?? file?.size ?? 0;
  const percent =
    status === 'success' ? 100 : formatPercent(uploadedBytes, totalBytes);
  const isSessionUpload = decision?.strategy === 'session';
  const canPause = status === 'running' && isSessionUpload;
  const canResume = status === 'paused' && isSessionUpload;
  const canCancel = (status === 'running' || status === 'paused') && isSessionUpload;
  const canClose = status === 'success' || status === 'error' || status === 'cancelled';
  const session = progress?.session;
  const phaseLabel = describePhase(t, status, progress);
  const statusTone =
    status === 'success' ? styles.importProgressToneSuccess
    : status === 'error' ? styles.importProgressToneError
    : status === 'paused' || status === 'cancelled' ? styles.importProgressToneWarning
    : '';

  const footer = (
    <div className={styles.importProgressFooter}>
      {canPause ? (
        <button type="button" className={styles.actionButton} onClick={onPause}>
          <IconRefreshCw size={15} />
          <span>{fallbackText(t, 'common.pause', 'Pause')}</span>
        </button>
      ) : null}
      {canResume ? (
        <button
          type="button"
          className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
          onClick={onResume}
        >
          <IconRefreshCw size={15} />
          <span>{fallbackText(t, 'common.resume', 'Resume')}</span>
        </button>
      ) : null}
      {canCancel ? (
        <button type="button" className={styles.actionButton} onClick={onCancel}>
          <IconTrash2 size={15} />
          <span>{t('common.cancel')}</span>
        </button>
      ) : null}
      {canClose ? (
        <button
          type="button"
          className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
          onClick={onClose}
        >
          <span>{t('common.close', { defaultValue: 'Close' })}</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <Modal
      open={open}
      title={fallbackText(t, 'usage_stats.import_progress_title', 'Import progress')}
      onClose={canClose ? onClose : () => {}}
      closeDisabled={!canClose}
      footer={footer}
      className={styles.monitorModal}
      width={560}
    >
      <div className={styles.importProgressBody}>
        <div className={`${styles.importProgressStatus} ${statusTone}`}>
          {status === 'success' ? (
            <IconCheckCircle2 size={20} />
          ) : status === 'error' ? (
            <IconAlertTriangle size={20} />
          ) : (
            <IconLoader2 size={20} className={styles.importProgressSpinner} />
          )}
          <div>
            <strong>{phaseLabel}</strong>
            <span>
              {isSessionUpload
                ? fallbackText(
                    t,
                    'usage_stats.import_progress_resumable',
                    'Resumable session upload'
                  )
                : fallbackText(t, 'usage_stats.import_progress_single_post', 'Direct import')}
            </span>
          </div>
        </div>

        <div className={styles.importProgressFile}>
          <IconFileText size={18} />
          <div>
            <strong>{file?.name ?? fallbackText(t, 'common.file', 'File')}</strong>
            <span>
              {formatFileSize(totalBytes)}
              {session?.status ? ` · ${session.status}` : ''}
            </span>
          </div>
        </div>

        <div className={styles.importProgressMeter} aria-label={phaseLabel}>
          <div className={styles.importProgressMeterTrack}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.importProgressMeta}>
            <span>{percent}%</span>
            <span>
              {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
            </span>
          </div>
        </div>

        {session ? (
          <dl className={styles.importProgressDetails}>
            <div>
              <dt>{fallbackText(t, 'usage_stats.import_progress_session', 'Session')}</dt>
              <dd>{session.id}</dd>
            </div>
            <div>
              <dt>{fallbackText(t, 'usage_stats.import_progress_received', 'Received')}</dt>
              <dd>{formatFileSize(session.receivedBytes)}</dd>
            </div>
          </dl>
        ) : null}

        {error ? <p className={styles.importProgressError}>{error}</p> : null}
      </div>
    </Modal>
  );
}
