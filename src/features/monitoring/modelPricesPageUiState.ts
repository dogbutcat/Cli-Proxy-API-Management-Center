import type { ModelPrice } from '@/services/api/usageService';
import type { ModelPriceMutationKind } from './model/modelPricesPageModel';

export type ModelPricesDraft = {
  model: string;
  input: string;
  output: string;
  cached: string;
  cacheRead: string;
  cacheCreation: string;
  currency: string;
  unit: string;
};

export type ModelPriceMutationFeedbackState =
  | { status: 'idle'; operation: null; message: null }
  | { status: 'pending'; operation: ModelPriceMutationKind; message: string }
  | { status: 'success'; operation: ModelPriceMutationKind; message: string }
  | { status: 'error'; operation: ModelPriceMutationKind; message: string }
  | { status: 'guarded'; operation: ModelPriceMutationKind; message: string };

export type ModelPricesPageUiState = {
  searchQuery: string;
  draft: ModelPricesDraft;
  deleteCandidate: string | null;
  confirmSave: boolean;
  confirmDelete: boolean;
  confirmSync: boolean;
  mutationFeedback: ModelPriceMutationFeedbackState;
};

export const createEmptyModelPricesDraft = (): ModelPricesDraft => ({
  model: '',
  input: '',
  output: '',
  cached: '',
  cacheRead: '',
  cacheCreation: '',
  currency: 'USD',
  unit: '1000000',
});

export const createDefaultModelPricesPageUiState = (): ModelPricesPageUiState => ({
  searchQuery: '',
  draft: createEmptyModelPricesDraft(),
  deleteCandidate: null,
  confirmSave: false,
  confirmDelete: false,
  confirmSync: false,
  mutationFeedback: { status: 'idle', operation: null, message: null },
});

export const setModelPricesSearchQuery = (
  state: ModelPricesPageUiState,
  searchQuery: string
): ModelPricesPageUiState => ({
  ...state,
  searchQuery,
});

const parseOptionalPriceNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildModelPriceFromDraft = (draft: ModelPricesDraft): ModelPrice => ({
  input: parseOptionalPriceNumber(draft.input),
  output: parseOptionalPriceNumber(draft.output),
  cached: parseOptionalPriceNumber(draft.cached),
  cacheRead: parseOptionalPriceNumber(draft.cacheRead),
  cacheCreation: parseOptionalPriceNumber(draft.cacheCreation),
  currency: draft.currency.trim() || 'USD',
  unit: parseOptionalPriceNumber(draft.unit) ?? 1_000_000,
});

export const fillModelPricesDraft = (
  model: string,
  price: ModelPrice | null | undefined
): ModelPricesDraft => ({
  model,
  input: price?.input === undefined ? '' : String(price.input),
  output: price?.output === undefined ? '' : String(price.output),
  cached: price?.cached === undefined ? '' : String(price.cached),
  cacheRead: price?.cacheRead === undefined ? '' : String(price.cacheRead),
  cacheCreation: price?.cacheCreation === undefined ? '' : String(price.cacheCreation),
  currency: price?.currency ?? 'USD',
  unit: String(price?.unit ?? 1_000_000),
});

export const setModelPricesMutationPending = (
  state: ModelPricesPageUiState,
  operation: ModelPriceMutationKind
): ModelPricesPageUiState => ({
  ...state,
  mutationFeedback: {
    status: 'pending',
    operation,
    message: `${operation} is running.`,
  },
});

export const setModelPricesMutationFeedback = (
  state: ModelPricesPageUiState,
  status: Exclude<ModelPriceMutationFeedbackState['status'], 'idle' | 'pending'>,
  operation: ModelPriceMutationKind,
  message: string
): ModelPricesPageUiState => ({
  ...state,
  confirmSave: operation === 'save' ? false : state.confirmSave,
  confirmDelete: operation === 'delete' ? false : state.confirmDelete,
  confirmSync: operation === 'sync' ? false : state.confirmSync,
  deleteCandidate: operation === 'delete' && status === 'success' ? null : state.deleteCandidate,
  mutationFeedback: {
    status,
    operation,
    message,
  },
});
