import type { TFunction } from 'i18next';
import type { AuthFileItem, OpenCodeGoQuotaState } from '@/types';
import { opencodeGoApi } from '@/services/api';
import { getAuthFileProviderKey } from '@/features/authFiles/constants';
import { deriveOpenCodeGoAuthFileIdentity } from '@/features/authFiles/identity';
import type { OpenCodeGoQuotaIdentityGroup } from '@/types/opencodeGo';
import type { QuotaProviderData } from '../types';

type OpenCodeGoQuotaData = Omit<OpenCodeGoQuotaState, 'status' | 'error' | 'errorStatus'>;

const getGroupKey = (group: OpenCodeGoQuotaIdentityGroup): string =>
  group.identity.identityKey || group.identityKey;

const selectQuotaGroup = (
  groups: OpenCodeGoQuotaIdentityGroup[],
  identityKey: string
): OpenCodeGoQuotaIdentityGroup | null =>
  groups.find((group) => getGroupKey(group) === identityKey) ?? null;

const readStatusText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getFileDiagnostic = (file: AuthFileItem): string => {
  const status = readStatusText(file.status).toLowerCase().replace(/-/g, '_');
  if (status.includes('exhausted')) return status;

  const message = readStatusText(file.statusMessage ?? file['status_message']);
  return message && message.toLowerCase() !== 'ok' ? message : '';
};

const getReferralPreview = async (
  workspace: string
): Promise<Pick<OpenCodeGoQuotaData, 'referralCode' | 'referralUrl' | 'referralError'>> => {
  if (!workspace) return {};
  try {
    const referral = await opencodeGoApi.getReferral(workspace);
    return {
      referralCode: referral.code,
      referralUrl: referral.url,
    };
  } catch (err: unknown) {
    return {
      referralError: err instanceof Error ? err.message : String(err || 'Unknown referral error'),
    };
  }
};

const fetchOpenCodeGoQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<OpenCodeGoQuotaData> => {
  const identity = deriveOpenCodeGoAuthFileIdentity(file);
  const fileDiagnostic = getFileDiagnostic(file);

  if (!identity.identityKey) {
    return {
      windows: [],
      identity,
      diagnostic:
        fileDiagnostic ||
        t('opencode_go_quota.missing_identity', { defaultValue: 'Missing workspace identity' }),
    };
  }

  const response = identity.entry
    ? await opencodeGoApi.refreshQuota(identity.entry)
    : await opencodeGoApi.getQuota();
  const group =
    selectQuotaGroup(response.groups, identity.identityKey) ??
    (identity.entry && response.groups.length === 1 ? response.groups[0] : null);
  if (!group) {
    if (fileDiagnostic) {
      return {
        windows: [],
        identity,
        diagnostic: fileDiagnostic,
      };
    }
    throw new Error(
      t('opencode_go_quota.missing_quota', { defaultValue: 'No quota data for this workspace' })
    );
  }

  const referral = await getReferralPreview(identity.workspace);

  return {
    windows: group.windows,
    identity: group.identity,
    diagnostic: fileDiagnostic || group.diagnostic,
    ...referral,
  };
};

export const OPENCODE_GO_CONFIG: QuotaProviderData<OpenCodeGoQuotaState, OpenCodeGoQuotaData> = {
  type: 'opencode-go',
  i18nPrefix: 'opencode_go_quota',
  filterFn: (file) => getAuthFileProviderKey(file) === 'opencode-go' && file.disabled !== true,
  fetchQuota: fetchOpenCodeGoQuota,
  storeSelector: (state) => state.opencodeGoQuota,
  storeSetter: 'setOpencodeGoQuota',
  buildLoadingState: () => ({ status: 'loading', windows: [] }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    windows: [],
    error: message,
    errorStatus: status,
  }),
};
