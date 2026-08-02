import { useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { HttpMethod, ParsedLogLine, StatusGroup } from './logTypes';
import { resolveStatusGroup } from './logTypes';

const PATH_FILTER_LIMIT = 12;
const SOURCE_FILTER_LIMIT = 12;

export type LogFilterPreset = {
  methods?: HttpMethod[];
  statuses?: StatusGroup[];
  paths?: string[];
  sources?: string[];
};

interface UseLogFiltersOptions {
  parsedLines: ParsedLogLine[];
}

interface UseLogFiltersReturn {
  methodFilters: HttpMethod[];
  statusFilters: StatusGroup[];
  pathFilters: string[];
  sourceFilters: string[];
  methodFilterSet: Set<HttpMethod>;
  statusFilterSet: Set<StatusGroup>;
  pathFilterSet: Set<string>;
  sourceFilterSet: Set<string>;
  hasStructuredFilters: boolean;
  methodCounts: Partial<Record<HttpMethod, number>>;
  statusCounts: Partial<Record<StatusGroup, number>>;
  pathOptions: Array<{ path: string; count: number }>;
  sourceOptions: Array<{ source: string; count: number }>;
  toggleMethodFilter: (method: HttpMethod) => void;
  toggleStatusFilter: (group: StatusGroup) => void;
  togglePathFilter: (path: string) => void;
  toggleSourceFilter: (source: string) => void;
  applyStructuredFilters: (preset: LogFilterPreset) => void;
  clearStructuredFilters: () => void;
}

export function useLogFilters(options: UseLogFiltersOptions): UseLogFiltersReturn {
  const { parsedLines } = options;

  const [methodFilters, setMethodFilters] = useLocalStorage<HttpMethod[]>(
    'logsPage.methodFilters',
    []
  );
  const [statusFilters, setStatusFilters] = useLocalStorage<StatusGroup[]>(
    'logsPage.statusFilters',
    []
  );
  const [pathFilters, setPathFilters] = useLocalStorage<string[]>('logsPage.pathFilters', []);
  const [sourceFilters, setSourceFilters] = useLocalStorage<string[]>('logsPage.sourceFilters', []);

  const methodFilterSet = useMemo(() => new Set(methodFilters), [methodFilters]);
  const statusFilterSet = useMemo(() => new Set(statusFilters), [statusFilters]);
  const pathFilterSet = useMemo(() => new Set(pathFilters), [pathFilters]);
  const sourceFilterSet = useMemo(() => new Set(sourceFilters), [sourceFilters]);
  const hasStructuredFilters =
    methodFilters.length > 0 ||
    statusFilters.length > 0 ||
    pathFilters.length > 0 ||
    sourceFilters.length > 0;

  const methodCounts = useMemo(() => {
    const counts: Partial<Record<HttpMethod, number>> = {};
    parsedLines.forEach((line) => {
      if (!line.method) return;
      counts[line.method] = (counts[line.method] ?? 0) + 1;
    });
    return counts;
  }, [parsedLines]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<StatusGroup, number>> = {};
    parsedLines.forEach((line) => {
      const statusGroup = resolveStatusGroup(line.statusCode);
      if (!statusGroup) return;
      counts[statusGroup] = (counts[statusGroup] ?? 0) + 1;
    });
    return counts;
  }, [parsedLines]);

  const pathOptions = useMemo(() => {
    const counts = new Map<string, number>();
    parsedLines.forEach((line) => {
      if (!line.path) return;
      counts.set(line.path, (counts.get(line.path) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, PATH_FILTER_LIMIT)
      .map(([path, count]) => ({ path, count }));
  }, [parsedLines]);

  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    parsedLines.forEach((line) => {
      if (!line.source) return;
      counts.set(line.source, (counts.get(line.source) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, SOURCE_FILTER_LIMIT)
      .map(([source, count]) => ({ source, count }));
  }, [parsedLines]);

  useEffect(() => {
    if (parsedLines.length === 0) return;

    const validPathSet = new Set(pathOptions.map((item) => item.path));
    setPathFilters((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((path) => validPathSet.has(path));
      return next.length === prev.length ? prev : next;
    });
  }, [parsedLines.length, pathOptions, setPathFilters]);

  useEffect(() => {
    if (parsedLines.length === 0) return;

    const validSourceSet = new Set(sourceOptions.map((item) => item.source));
    setSourceFilters((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((source) => validSourceSet.has(source));
      return next.length === prev.length ? prev : next;
    });
  }, [parsedLines.length, setSourceFilters, sourceOptions]);

  const toggleMethodFilter = (method: HttpMethod) => {
    setMethodFilters((prev) =>
      prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method]
    );
  };

  const toggleStatusFilter = (group: StatusGroup) => {
    setStatusFilters((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group]
    );
  };

  const togglePathFilter = (path: string) => {
    setPathFilters((prev) =>
      prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
    );
  };

  const toggleSourceFilter = (source: string) => {
    setSourceFilters((prev) =>
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]
    );
  };

  const applyStructuredFilters = useCallback(
    (preset: LogFilterPreset) => {
      if (preset.methods) setMethodFilters(preset.methods);
      if (preset.statuses) setStatusFilters(preset.statuses);
      if (preset.paths) setPathFilters(preset.paths);
      if (preset.sources) setSourceFilters(preset.sources);
    },
    [setMethodFilters, setPathFilters, setSourceFilters, setStatusFilters]
  );

  const clearStructuredFilters = useCallback(() => {
    setMethodFilters([]);
    setStatusFilters([]);
    setPathFilters([]);
    setSourceFilters([]);
  }, [setMethodFilters, setPathFilters, setSourceFilters, setStatusFilters]);

  return {
    methodFilters,
    statusFilters,
    pathFilters,
    sourceFilters,
    methodFilterSet,
    statusFilterSet,
    pathFilterSet,
    sourceFilterSet,
    hasStructuredFilters,
    methodCounts,
    statusCounts,
    pathOptions,
    sourceOptions,
    toggleMethodFilter,
    toggleStatusFilter,
    togglePathFilter,
    toggleSourceFilter,
    applyStructuredFilters,
    clearStructuredFilters,
  };
}
