import type {
  ModelPrice,
  ModelPricesResponse,
  ModelPriceSyncResponse,
  ModelPriceUsageSummaryResponse,
  UsageApiResult,
} from '@/services/api/usageService';

export type ModelPriceRowState = 'missing' | 'priced';
export type ModelPricesDataState = 'empty' | 'missing' | 'priced' | 'partial';
export type ModelPricesRequestState = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
export type ModelPricesSummaryState =
  'idle' | 'ready' | 'empty' | 'partial' | 'error' | 'unsupported';

export type ModelPriceRow = {
  model: string;
  price: ModelPrice | null;
  priceState: ModelPriceRowState;
  calls: number;
  requestedCalls: number;
  resolvedCalls: number;
  currency: string;
  unit: number;
};

export type ModelPricesPageModel = {
  rows: ModelPriceRow[];
  filteredRows: ModelPriceRow[];
  dataState: ModelPricesDataState;
  requestState: ModelPricesRequestState;
  summaryState: ModelPricesSummaryState;
  stale: boolean;
  partial: boolean;
  missingCount: number;
  pricedCount: number;
  totalCalls: number;
  feedback: string | null;
  summaryFeedback: string | null;
};

export type ModelPricesPageData = {
  prices: Record<string, ModelPrice>;
  summary: ModelPriceUsageSummaryResponse | null;
  requestState: ModelPricesRequestState;
  summaryState: ModelPricesSummaryState;
  stale: boolean;
  partial: boolean;
  feedback: string | null;
  summaryFeedback: string | null;
  updatedAtMs: number | null;
};

export type ModelPricesApiLike = {
  savePrices: (prices: Record<string, ModelPrice>) => Promise<UsageApiResult<ModelPricesResponse>>;
  deletePrice: (model: string) => Promise<UsageApiResult<ModelPricesResponse>>;
  sync: (models?: string[]) => Promise<UsageApiResult<ModelPriceSyncResponse>>;
};

export type ModelPriceMutationKind = 'save' | 'delete' | 'sync';
export type ModelPriceMutationStatus = 'success' | 'error' | 'guarded';

export type ModelPriceMutationOutcome<T> = {
  status: ModelPriceMutationStatus;
  operation: ModelPriceMutationKind;
  message: string;
  result?: UsageApiResult<T>;
};

export const MODEL_PRICE_MUTATION_GUARD_TOKEN = 'model-prices-explicit-confirmation';

export type ModelPriceMutationGuard = {
  confirmed: true;
  token: typeof MODEL_PRICE_MUTATION_GUARD_TOKEN;
};

const PRICE_FIELDS: Array<keyof ModelPrice> = [
  'input',
  'output',
  'cached',
  'cacheRead',
  'cacheCreation',
];

export const createModelPriceMutationGuard = (
  confirmed: boolean
): ModelPriceMutationGuard | null =>
  confirmed ? { confirmed: true, token: MODEL_PRICE_MUTATION_GUARD_TOKEN } : null;

export const isModelPriceMutationGuard = (
  guard: ModelPriceMutationGuard | null | undefined
): guard is ModelPriceMutationGuard =>
  guard?.confirmed === true && guard.token === MODEL_PRICE_MUTATION_GUARD_TOKEN;

export const createInitialModelPricesPageData = (): ModelPricesPageData => ({
  prices: {},
  summary: null,
  requestState: 'idle',
  summaryState: 'idle',
  stale: false,
  partial: false,
  feedback: null,
  summaryFeedback: null,
  updatedAtMs: null,
});

const isPositivePrice = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const classifyModelPrice = (price: ModelPrice | null | undefined): ModelPriceRowState =>
  price && PRICE_FIELDS.some((field) => isPositivePrice(price[field])) ? 'priced' : 'missing';

const normalizeQuery = (searchQuery: string): string => searchQuery.trim().toLowerCase();

const compareRows = (a: ModelPriceRow, b: ModelPriceRow): number => {
  if (a.priceState !== b.priceState) return a.priceState === 'missing' ? -1 : 1;
  if (b.calls !== a.calls) return b.calls - a.calls;
  return a.model.localeCompare(b.model);
};

const summarizeDataState = (rows: ModelPriceRow[]): ModelPricesDataState => {
  if (rows.length === 0) return 'empty';
  const missing = rows.some((row) => row.priceState === 'missing');
  const priced = rows.some((row) => row.priceState === 'priced');
  if (missing && priced) return 'partial';
  return priced ? 'priced' : 'missing';
};

const readSummaryState = (
  result: UsageApiResult<ModelPriceUsageSummaryResponse>
): ModelPricesSummaryState => {
  if (result.kind === 'unsupported') return 'unsupported';
  if (result.kind === 'error') return 'error';
  if (result.kind === 'empty' || result.data.models.length === 0) return 'empty';
  return result.status?.partial ? 'partial' : 'ready';
};

const readResultMessage = (result: UsageApiResult<unknown>, fallback: string): string => {
  if (result.kind === 'unsupported' || result.kind === 'error') return result.message;
  if (result.status?.errors.length) return result.status.errors[0]?.message ?? fallback;
  if (result.status?.warnings.length) return result.status.warnings[0]?.message ?? fallback;
  return fallback;
};

export const applyModelPricesListResult = (
  current: ModelPricesPageData,
  result: UsageApiResult<ModelPricesResponse>,
  nowMs = Date.now()
): ModelPricesPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    return {
      ...current,
      prices: { ...result.data.prices },
      requestState: 'ready',
      stale: Boolean(result.status?.stale),
      partial: Boolean(result.status?.partial),
      feedback: result.kind === 'empty' ? 'No model prices are configured.' : null,
      updatedAtMs: nowMs,
    };
  }

  if (result.kind === 'unsupported') {
    return {
      ...current,
      requestState: 'unsupported',
      stale: Object.keys(current.prices).length > 0,
      feedback: readResultMessage(result, 'Model prices are unsupported by this backend.'),
    };
  }

  return {
    ...current,
    requestState: 'error',
    stale: Object.keys(current.prices).length > 0,
    feedback: readResultMessage(result, 'Model prices request failed.'),
  };
};

export const applyModelPricesSummaryResult = (
  current: ModelPricesPageData,
  result: UsageApiResult<ModelPriceUsageSummaryResponse>
): ModelPricesPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    return {
      ...current,
      summary: result.data,
      summaryState: readSummaryState(result),
      partial: current.partial || Boolean(result.status?.partial),
      summaryFeedback:
        result.kind === 'empty' || result.data.models.length === 0
          ? 'No recent usage models were sampled.'
          : null,
    };
  }

  return {
    ...current,
    summaryState: result.kind === 'unsupported' ? 'unsupported' : 'error',
    summaryFeedback: readResultMessage(result, 'Model price usage summary failed.'),
  };
};

export const applyModelPricesMutationResult = <T extends ModelPricesResponse>(
  current: ModelPricesPageData,
  result: UsageApiResult<T>,
  nowMs = Date.now()
): ModelPricesPageData => {
  if (result.kind === 'success' || result.kind === 'empty') {
    return applyModelPricesListResult(current, result, nowMs);
  }
  return {
    ...current,
    feedback: readResultMessage(result, 'Model price mutation failed.'),
  };
};

export const buildModelPricesPageModel = (
  data: ModelPricesPageData,
  searchQuery = ''
): ModelPricesPageModel => {
  const summaryByModel = new Map((data.summary?.models ?? []).map((item) => [item.model, item]));
  const modelNames = new Set([...Object.keys(data.prices), ...summaryByModel.keys()]);
  const rows = [...modelNames]
    .filter(Boolean)
    .map((model): ModelPriceRow => {
      const price = data.prices[model] ?? null;
      const usage = summaryByModel.get(model);
      return {
        model,
        price,
        priceState: classifyModelPrice(price),
        calls: usage?.calls ?? 0,
        requestedCalls: usage?.requestedCalls ?? 0,
        resolvedCalls: usage?.resolvedCalls ?? 0,
        currency: price?.currency ?? 'USD',
        unit: price?.unit ?? 1_000_000,
      };
    })
    .sort(compareRows);
  const query = normalizeQuery(searchQuery);
  const filteredRows = query ? rows.filter((row) => row.model.toLowerCase().includes(query)) : rows;
  const missingCount = rows.filter((row) => row.priceState === 'missing').length;
  const pricedCount = rows.length - missingCount;

  return {
    rows,
    filteredRows,
    dataState: summarizeDataState(rows),
    requestState: data.requestState,
    summaryState: data.summaryState,
    stale: data.stale,
    partial: data.partial || data.summaryState === 'partial',
    missingCount,
    pricedCount,
    totalCalls: rows.reduce((total, row) => total + row.calls, 0),
    feedback: data.feedback,
    summaryFeedback: data.summaryFeedback,
  };
};

const guardedOutcome = <T>(operation: ModelPriceMutationKind): ModelPriceMutationOutcome<T> => ({
  status: 'guarded',
  operation,
  message: 'Confirm this mutation before it can run.',
});

const resultOutcome = <T>(
  operation: ModelPriceMutationKind,
  result: UsageApiResult<T>,
  successMessage: string
): ModelPriceMutationOutcome<T> => {
  if (result.kind === 'success' || result.kind === 'empty') {
    return { status: 'success', operation, message: successMessage, result };
  }
  return {
    status: 'error',
    operation,
    message: readResultMessage(result, 'Model price mutation failed.'),
    result,
  };
};

export const runGuardedModelPriceSave = async (
  api: Pick<ModelPricesApiLike, 'savePrices'>,
  prices: Record<string, ModelPrice>,
  guard: ModelPriceMutationGuard | null | undefined
): Promise<ModelPriceMutationOutcome<ModelPricesResponse>> => {
  if (!isModelPriceMutationGuard(guard)) return guardedOutcome('save');
  return resultOutcome('save', await api.savePrices(prices), 'Model prices saved.');
};

export const runGuardedModelPriceDelete = async (
  api: Pick<ModelPricesApiLike, 'deletePrice'>,
  model: string,
  guard: ModelPriceMutationGuard | null | undefined
): Promise<ModelPriceMutationOutcome<ModelPricesResponse>> => {
  if (!isModelPriceMutationGuard(guard)) return guardedOutcome('delete');
  return resultOutcome('delete', await api.deletePrice(model), 'Model price deleted.');
};

export const runGuardedModelPriceSync = async (
  api: Pick<ModelPricesApiLike, 'sync'>,
  models: string[] | undefined,
  guard: ModelPriceMutationGuard | null | undefined
): Promise<ModelPriceMutationOutcome<ModelPriceSyncResponse>> => {
  if (!isModelPriceMutationGuard(guard)) return guardedOutcome('sync');
  return resultOutcome('sync', await api.sync(models), 'Model prices synced.');
};
