import type { Config } from '@/types/config';

export const isFileLogsAvailable = (config: Config | null | undefined): boolean =>
  Boolean(config?.loggingToFile);
