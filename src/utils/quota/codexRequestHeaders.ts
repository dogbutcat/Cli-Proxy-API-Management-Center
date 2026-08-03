// Stub for codex request headers - not used in MC but imported by providerRequests

export const codexRequestHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const buildCodexResetCreditsRequestHeaders = codexRequestHeaders;
export const buildCodexUsageRequestHeaders = codexRequestHeaders;
