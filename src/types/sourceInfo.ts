export type SourceProviderEnabledState = 'enabled' | 'disabled' | 'mixed';

export type SourceInfo = {
  displayName: string;
  type: string;
  identityKey?: string;
  providerEnabledState?: SourceProviderEnabledState;
  /** Provider-level display name (e.g. "opencode-go-claude"). Falls back to displayName when absent. */
  providerName?: string;
  /** Full raw API key from config, when available. Used for copy-to-clipboard in the Keys tab. */
  rawApiKey?: string;
};

export type CredentialInfo = {
  name: string;
  type: string;
};
