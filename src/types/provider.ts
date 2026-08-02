/**
 * AI provider-related types.
 * Based on the original src/modules/ai-providers.js module.
 */

import type { OpenCodeGoIdentity, OpenCodeGoIdentityStatus } from './opencodeGo';

export interface ProviderIdentityConfig {
  aliases?: string[];
  provider?: string;
  entry?: string;
  workspace?: string;
  project?: string;
  protocol?: string;
  safeLabel?: string;
  identityKey?: string;
  diagnostic?: OpenCodeGoIdentityStatus;
}

export interface ModelAlias {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  image?: boolean;
  thinking?: Record<string, unknown>;
}

export interface ApiKeyEntry {
  apiKey: string;
  proxyUrl?: string;
  weight?: number;
  authIndex?: string;
  identity?: ProviderIdentityConfig;
  opencodeGoIdentity?: OpenCodeGoIdentity;
}

export interface CloakConfig {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
  cacheUserId?: boolean;
}

export interface GeminiKeyConfig {
  apiKey: string;
  priority?: number;
  weight?: number;
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;
  models?: ModelAlias[];
  headers?: Record<string, string>;
  excludedModels?: string[];
  disableCooling?: boolean;
  authIndex?: string;
  identity?: ProviderIdentityConfig;
  opencodeGoIdentity?: OpenCodeGoIdentity;
}

export interface ProviderKeyConfig {
  apiKey: string;
  priority?: number;
  weight?: number;
  prefix?: string;
  baseUrl?: string;
  websockets?: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  excludedModels?: string[];
  disableCooling?: boolean;
  cloak?: CloakConfig;
  fingerprintProfile?: string;
  authIndex?: string;
  identity?: ProviderIdentityConfig;
  opencodeGoIdentity?: OpenCodeGoIdentity;
}

export interface OpenAIProviderConfig {
  name: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  disabled?: boolean;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
  testModel?: string;
  disableCooling?: boolean;
  authIndex?: string;
  identity?: ProviderIdentityConfig;
  opencodeGoIdentity?: OpenCodeGoIdentity;
  /** Original index in the backend openai-compatibility array. */
  sourceIndex?: number;
  [key: string]: unknown;
}
