import { useMemo } from 'react';
import type { AuthFileItem } from '@/types';
import {
  normalizeRecentRequestAuthIndex,
  normalizeRecentRequestBuckets,
  statusBarDataFromRecentRequests,
} from '@/utils/recentRequests';
import { getAuthFileProviderKey } from '@/features/authFiles/constants';
import { deriveOpenCodeGoAuthFileIdentity } from '@/features/authFiles/identity';

export type AuthFileStatusBarData = ReturnType<typeof statusBarDataFromRecentRequests>;

export function useAuthFilesStatusBarCache(files: AuthFileItem[]) {
  return useMemo(() => {
    const cache = new Map<string, AuthFileStatusBarData>();

    files.forEach((file) => {
      const rawAuthIndex = file['auth_index'] ?? file.authIndex;
      const authIndexKey = normalizeRecentRequestAuthIndex(rawAuthIndex);
      const identityKey =
        getAuthFileProviderKey(file) === 'opencode-go'
          ? deriveOpenCodeGoAuthFileIdentity(file).identityKey
          : '';
      if (!authIndexKey && !identityKey) return;

      const statusData = statusBarDataFromRecentRequests(
        normalizeRecentRequestBuckets(file.recent_requests ?? file.recentRequests)
      );

      if (authIndexKey) cache.set(authIndexKey, statusData);
      if (identityKey) cache.set(identityKey, statusData);
    });

    return cache;
  }, [files]);
}
