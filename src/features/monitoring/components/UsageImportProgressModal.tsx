import type { CSSProperties } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconLoader2,
  IconRefreshCw,
  IconTrash2,
  IconUpload,
} from '@/components/ui/icons';
import type { UsageImportSession } from '@/services/api/usageService';
import {
  classifyUsageImportRecovery,
  getUsageImportProgressPercent,
  type UsageImportRecovery,
} from '../services/usageImportSession';

type UsageImportProgressModalProps = {
  open: boolean;
  session?: UsageImportSession | null;
  recovery?: UsageImportRecovery | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRestart?: () => void;
};

const styles = {
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statusHeader: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  iconShell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg-secondary)',
    color: 'var(--accent-color)',
  },
  title: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: 16,
    fontWeight: 700,
  },
  subtitle: {
    margin: '3px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  progressTrack: {
    position: 'relative',
    overflow: 'hidden',
    height: 10,
    borderRadius: 8,
    background: 'var(--bg-tertiary, rgba(127,127,127,0.18))',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    background: 'var(--accent-color)',
    transition: 'width 180ms ease',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  metaItem: {
    padding: 10,
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
  },
  metaLabel: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  metaValue: {
    margin: '5px 0 0',
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  alert: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--amber-color, #c78100) 45%, transparent)',
    background: 'color-mix(in srgb, var(--amber-color, #c78100) 10%, transparent)',
    color: 'var(--text-primary)',
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
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
  },
  dangerButton: {
    borderColor: 'color-mix(in srgb, var(--danger-color, #dc2626) 55%, transparent)',
    color: 'var(--danger-color, #dc2626)',
  },
  primaryButton: {
    borderColor: 'var(--accent-color)',
    background: 'var(--accent-color)',
    color: 'var(--accent-contrast, #fff)',
  },
} satisfies Record<string, CSSProperties>;

const formatBytes = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

const describeRecovery = (recovery: UsageImportRecovery | null | undefined): string => {
  if (!recovery) return 'No import session is active.';
  if (recovery.state === 'recoverable') return 'This import can resume from the saved upload offset.';
  if (recovery.state === 'completed') return 'Import completed and local recovery metadata was cleared.';
  if (recovery.reason === 'expired') return 'The saved import session expired. Start a new import.';
  if (recovery.reason === 'file_mismatch') return 'The selected file does not match the saved session.';
  return 'This import cannot resume. Start a new import.';
};

const getStatusIcon = (
  session: UsageImportSession | null | undefined,
  recovery: UsageImportRecovery | null | undefined,
  busy: boolean | undefined
) => {
  if (busy || session?.status === 'uploading' || session?.status === 'processing') {
    return <IconLoader2 size={18} aria-hidden="true" />;
  }
  if (session?.status === 'completed' || recovery?.state === 'completed') {
    return <IconCheckCircle2 size={18} aria-hidden="true" />;
  }
  if (recovery?.state === 'restart_required' || session?.status === 'failed') {
    return <IconAlertTriangle size={18} aria-hidden="true" />;
  }
  return <IconUpload size={18} aria-hidden="true" />;
};

export function UsageImportProgressModal({
  open,
  session,
  recovery,
  busy = false,
  error,
  onClose,
  onCancel,
  onRetry,
  onRestart,
}: UsageImportProgressModalProps) {
  const resolvedRecovery = recovery ?? classifyUsageImportRecovery(session, null);
  const percent = session ? getUsageImportProgressPercent(session) : 0;
  const canCancel = Boolean(onCancel && session && !['completed', 'cancelled'].includes(session.status));
  const canRetry = Boolean(onRetry && resolvedRecovery.state === 'recoverable');
  const canRestart = Boolean(onRestart && resolvedRecovery.state === 'restart_required');
  const statusText = session
    ? `${session.status} - ${percent}%`
    : resolvedRecovery.state === 'recoverable'
      ? 'Recoverable session'
      : 'No active import';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Usage import"
      closeDisabled={busy}
      footer={
        <div style={styles.footer}>
          {canCancel && (
            <button
              id="usage-import-cancel"
              type="button"
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={onCancel}
              disabled={busy}
            >
              <IconTrash2 size={16} aria-hidden="true" />
              Cancel
            </button>
          )}
          {canRetry && (
            <button
              id="usage-import-retry"
              type="button"
              style={styles.button}
              onClick={onRetry}
              disabled={busy}
            >
              <IconRefreshCw size={16} aria-hidden="true" />
              Resume
            </button>
          )}
          {canRestart && (
            <button
              id="usage-import-restart"
              type="button"
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={onRestart}
              disabled={busy}
            >
              <IconUpload size={16} aria-hidden="true" />
              Restart
            </button>
          )}
          <button id="usage-import-close" type="button" style={styles.button} onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      }
      width={560}
    >
      <div style={styles.body} aria-live="polite">
        <div style={styles.statusHeader}>
          <div style={styles.iconShell}>{getStatusIcon(session, resolvedRecovery, busy)}</div>
          <div>
            <p style={styles.title}>{statusText}</p>
            <p style={styles.subtitle}>{describeRecovery(resolvedRecovery)}</p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Usage import progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={styles.progressTrack}
        >
          <div style={{ ...styles.progressFill, width: `${percent}%` }} />
        </div>

        {session && (
          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <p style={styles.metaLabel}>File</p>
              <p style={styles.metaValue}>{session.filename}</p>
            </div>
            <div style={styles.metaItem}>
              <p style={styles.metaLabel}>Uploaded</p>
              <p style={styles.metaValue}>
                {formatBytes(session.receivedBytes)} / {formatBytes(session.sizeBytes)}
              </p>
            </div>
          </div>
        )}

        {(error || session?.error) && (
          <div style={styles.alert} role="alert">
            <IconAlertTriangle size={16} aria-hidden="true" />
            <span>{error || session?.error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
