import { describe, expect, test } from 'bun:test';
import {
  applyModelPricesListResult,
  applyModelPricesSummaryResult,
  buildModelPricesPageModel,
  classifyModelPrice,
  createInitialModelPricesPageData,
  createModelPriceMutationGuard,
  runGuardedModelPriceDelete,
  runGuardedModelPriceSave,
  runGuardedModelPriceSync,
  type ModelPricesApiLike,
} from '../src/features/monitoring/model/modelPricesPageModel';
import { setModelPricesSearchQuery } from '../src/features/monitoring/modelPricesPageUiState';
import type {
  ModelPrice,
  ModelPricesResponse,
  ModelPriceSyncResponse,
  ModelPriceUsageSummaryResponse,
  UsageApiResult,
} from '../src/services/api/usageService';

const success = <T>(data: T): UsageApiResult<T> => ({ kind: 'success', data });

const error = <T>(message: string): UsageApiResult<T> => ({
  kind: 'error',
  message,
});

const unsupported = <T>(message: string): UsageApiResult<T> => ({
  kind: 'unsupported',
  message,
});

const prices = (records: Record<string, ModelPrice>): ModelPricesResponse => ({
  prices: records,
});

const summary = (
  models: ModelPriceUsageSummaryResponse['models'],
  overrides: Partial<ModelPriceUsageSummaryResponse> = {}
): ModelPriceUsageSummaryResponse => ({
  sampledEvents: 10,
  totalEvents: 10,
  truncated: false,
  models,
  ...overrides,
});

const apiFixture = () => {
  const calls: string[] = [];
  const api: ModelPricesApiLike = {
    savePrices: async (nextPrices) => {
      calls.push(`save:${Object.keys(nextPrices).join(',')}`);
      return success(prices(nextPrices));
    },
    deletePrice: async (model) => {
      calls.push(`delete:${model}`);
      return success(prices({}));
    },
    sync: async (models) => {
      calls.push(`sync:${models?.join(',') ?? 'all'}`);
      return success<ModelPriceSyncResponse>({
        ...prices({ 'claude-3-5-sonnet': { input: 3, output: 15, currency: 'USD' } }),
        imported: 1,
        skipped: 0,
      });
    },
  };
  return { api, calls };
};

describe('model prices page states', () => {
  test('classifies zero-price records as legal missing-price data', () => {
    expect(classifyModelPrice({ input: 0, output: 0, currency: 'USD' })).toBe('missing');
    expect(classifyModelPrice({ input: 0.01, output: 0 })).toBe('priced');

    const data = applyModelPricesSummaryResult(
      applyModelPricesListResult(
        createInitialModelPricesPageData(),
        success(prices({ 'zero-price-model': { input: 0, output: 0, currency: 'USD' } })),
        100
      ),
      success(
        summary([
          {
            model: 'zero-price-model',
            calls: 4,
            requestedCalls: 4,
            resolvedCalls: 4,
          },
        ])
      )
    );
    const model = buildModelPricesPageModel(data);

    expect(model.requestState).toBe('ready');
    expect(model.dataState).toBe('missing');
    expect(model.missingCount).toBe(1);
    expect(model.feedback).toBeNull();
    expect(model.rows[0]).toMatchObject({
      model: 'zero-price-model',
      priceState: 'missing',
      calls: 4,
    });
  });

  test('merges price records with usage summary into partial priced and missing rows', () => {
    const data = applyModelPricesSummaryResult(
      applyModelPricesListResult(
        createInitialModelPricesPageData(),
        success(prices({ priced: { input: 1, output: 2, unit: 1_000_000 } })),
        100
      ),
      success(
        summary([
          { model: 'priced', calls: 5, requestedCalls: 5, resolvedCalls: 5 },
          { model: 'missing-from-usage', calls: 3, requestedCalls: 3, resolvedCalls: 0 },
        ])
      )
    );
    const model = buildModelPricesPageModel(data);

    expect(model.dataState).toBe('partial');
    expect(model.pricedCount).toBe(1);
    expect(model.missingCount).toBe(1);
    expect(model.rows.map((row) => row.model)).toEqual(['missing-from-usage', 'priced']);
  });

  test('preserves last-good rows and exposes stale request error feedback separately', () => {
    const withGoodData = applyModelPricesListResult(
      createInitialModelPricesPageData(),
      success(prices({ priced: { input: 1, output: 2 } })),
      100
    );
    const afterError = applyModelPricesListResult(withGoodData, error('network down'), 200);
    const model = buildModelPricesPageModel(afterError);

    expect(model.requestState).toBe('error');
    expect(model.stale).toBe(true);
    expect(model.feedback).toBe('network down');
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.model).toBe('priced');
  });

  test('distinguishes unsupported and sync summary error from list data state', () => {
    const unsupportedData = applyModelPricesListResult(
      createInitialModelPricesPageData(),
      unsupported('not enabled'),
      100
    );
    const summaryErrorData = applyModelPricesSummaryResult(
      applyModelPricesListResult(
        createInitialModelPricesPageData(),
        success(prices({ priced: { input: 1 } })),
        100
      ),
      error('summary failed')
    );

    expect(buildModelPricesPageModel(unsupportedData)).toMatchObject({
      requestState: 'unsupported',
      feedback: 'not enabled',
    });
    expect(buildModelPricesPageModel(summaryErrorData)).toMatchObject({
      requestState: 'ready',
      summaryState: 'error',
      summaryFeedback: 'summary failed',
      dataState: 'priced',
    });
  });

  test('search filters derived rows without mutating the last-good source list', () => {
    const data = applyModelPricesListResult(
      createInitialModelPricesPageData(),
      success(
        prices({
          alpha: { input: 1 },
          beta: { input: 2 },
        })
      ),
      100
    );
    const uiState = setModelPricesSearchQuery(
      {
        searchQuery: '',
        draft: {
          model: '',
          input: '',
          output: '',
          cached: '',
          cacheRead: '',
          cacheCreation: '',
          currency: 'USD',
          unit: '1000000',
        },
        deleteCandidate: null,
        confirmSave: false,
        confirmDelete: false,
        confirmSync: false,
        mutationFeedback: { status: 'idle', operation: null, message: null },
      },
      'alp'
    );
    const model = buildModelPricesPageModel(data, uiState.searchQuery);

    expect(model.filteredRows.map((row) => row.model)).toEqual(['alpha']);
    expect(model.rows.map((row) => row.model)).toEqual(['alpha', 'beta']);
    expect(Object.keys(data.prices)).toEqual(['alpha', 'beta']);
  });

  test('save, delete, and sync guards block unconfirmed mutation calls', async () => {
    const { api, calls } = apiFixture();

    const save = await runGuardedModelPriceSave(api, { model: { input: 1 } }, null);
    const deleteResult = await runGuardedModelPriceDelete(api, 'model', null);
    const syncResult = await runGuardedModelPriceSync(api, undefined, null);

    expect([save.status, deleteResult.status, syncResult.status]).toEqual([
      'guarded',
      'guarded',
      'guarded',
    ]);
    expect(calls).toEqual([]);
  });

  test('confirmed mutation calls use fake APIs and return feedback', async () => {
    const { api, calls } = apiFixture();
    const guard = createModelPriceMutationGuard(true);

    const save = await runGuardedModelPriceSave(api, { model: { input: 1 } }, guard);
    const deleteResult = await runGuardedModelPriceDelete(api, 'model', guard);
    const syncResult = await runGuardedModelPriceSync(api, ['missing'], guard);

    expect(calls).toEqual(['save:model', 'delete:model', 'sync:missing']);
    expect(save).toMatchObject({ status: 'success', message: 'Model prices saved.' });
    expect(deleteResult).toMatchObject({ status: 'success', message: 'Model price deleted.' });
    expect(syncResult).toMatchObject({ status: 'success', message: 'Model prices synced.' });
  });
});
