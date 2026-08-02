/**
 * Quota cache that survives route switches.
 */

import { create } from 'zustand';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  KimiQuotaState,
  XaiQuotaState,
} from '@/types';

type QuotaUpdater<T> = T | ((prev: T) => T);
type QuotaCache<T> = Record<string, T>;

interface QuotaStoreState {
  cacheGeneration: number;
  // Quota maps are keyed by QuotaFileEntry.cacheKey, not necessarily file.name.
  antigravityQuota: QuotaCache<AntigravityQuotaState>;
  claudeQuota: QuotaCache<ClaudeQuotaState>;
  codexQuota: QuotaCache<CodexQuotaState>;
  kimiQuota: QuotaCache<KimiQuotaState>;
  xaiQuota: QuotaCache<XaiQuotaState>;
  setAntigravityQuota: (updater: QuotaUpdater<QuotaCache<AntigravityQuotaState>>) => void;
  setClaudeQuota: (updater: QuotaUpdater<QuotaCache<ClaudeQuotaState>>) => void;
  setCodexQuota: (updater: QuotaUpdater<QuotaCache<CodexQuotaState>>) => void;
  setKimiQuota: (updater: QuotaUpdater<QuotaCache<KimiQuotaState>>) => void;
  setXaiQuota: (updater: QuotaUpdater<QuotaCache<XaiQuotaState>>) => void;
  clearQuotaCache: () => void;
}

const resolveUpdater = <T>(updater: QuotaUpdater<T>, prev: T): T => {
  if (typeof updater === 'function') {
    return (updater as (value: T) => T)(prev);
  }
  return updater;
};

export const useQuotaStore = create<QuotaStoreState>((set) => ({
  cacheGeneration: 0,
  antigravityQuota: {},
  claudeQuota: {},
  codexQuota: {},
  kimiQuota: {},
  xaiQuota: {},
  setAntigravityQuota: (updater) =>
    set((state) => ({
      antigravityQuota: resolveUpdater(updater, state.antigravityQuota),
    })),
  setClaudeQuota: (updater) =>
    set((state) => ({
      claudeQuota: resolveUpdater(updater, state.claudeQuota),
    })),
  setCodexQuota: (updater) =>
    set((state) => ({
      codexQuota: resolveUpdater(updater, state.codexQuota),
    })),
  setKimiQuota: (updater) =>
    set((state) => ({
      kimiQuota: resolveUpdater(updater, state.kimiQuota),
    })),
  setXaiQuota: (updater) =>
    set((state) => ({
      xaiQuota: resolveUpdater(updater, state.xaiQuota),
    })),
  clearQuotaCache: () =>
    set((state) => ({
      cacheGeneration: state.cacheGeneration + 1,
      antigravityQuota: {},
      claudeQuota: {},
      codexQuota: {},
      kimiQuota: {},
      xaiQuota: {},
    })),
}));

export const captureQuotaCacheGeneration = (): number =>
  useQuotaStore.getState().cacheGeneration;

export const commitIfQuotaCacheCurrent = (
  generation: number,
  commit: () => void
): boolean => {
  if (useQuotaStore.getState().cacheGeneration !== generation) return false;
  commit();
  return true;
};
