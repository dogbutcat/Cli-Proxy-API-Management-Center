import { authFilesApi } from '@/services/api/authFiles';
import { apiClient } from '@/services/api/client';
import type { Config } from '@/types/config';
import { extractArrayPayload } from '../model/base';
import { normalizeOpenAIChannel } from '../model/authMeta';
import type { MonitoringChannelMeta, MonitoringMetaPayload } from '../model/types';

export const loadMonitoringMetaPayload = async (
  config: Config | null | undefined
): Promise<MonitoringMetaPayload> => {
  const [authResult, channelResult] = await Promise.allSettled([
    authFilesApi.list(),
    apiClient.get('/openai-compatibility'),
  ]);

  const authFiles =
    authResult.status === 'fulfilled' && Array.isArray(authResult.value.files)
      ? authResult.value.files
      : [];

  let channels: MonitoringChannelMeta[] = [];

  if (channelResult.status === 'fulfilled') {
    channels = extractArrayPayload(channelResult.value, 'openai-compatibility')
      .map((item, index) => normalizeOpenAIChannel(item, index))
      .filter(Boolean) as MonitoringChannelMeta[];
  } else if (config?.openaiCompatibility?.length) {
    channels = config.openaiCompatibility
      .map((item, index) =>
        normalizeOpenAIChannel(
          {
            ...item,
            'base-url': item.baseUrl,
            'api-key-entries': item.apiKeyEntries,
            models: item.models,
          },
          index
        )
      )
      .filter(Boolean) as MonitoringChannelMeta[];
  }

  const error = [authResult, channelResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => (result.status === 'rejected' ? result.reason : null))
    .filter(Boolean)
    .map((err) => (err instanceof Error ? err.message : String(err)))
    .join('；');

  // Append claude multikey entries as channels so they correctly claim
  // their auth indices (overriding any openai-compat channel that shares
  // the same keys). channelByAuthIndex uses last-write-wins, so these
  // must come AFTER the openai-compat channels.
  if (config?.claudeMultikeyEntries?.length) {
    const mkChannels = config.claudeMultikeyEntries
      .map((item, index) =>
        normalizeOpenAIChannel(
          {
            ...item,
            'base-url': item.baseUrl,
            'api-key-entries': item.apiKeyEntries,
            models: item.models,
          },
          channels.length + index
        )
      )
      .filter(Boolean) as MonitoringChannelMeta[];
    channels = [...channels, ...mkChannels];
  }

  return { authFiles, channels, error };
};
