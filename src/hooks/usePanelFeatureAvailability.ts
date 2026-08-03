import { useEffect, useMemo, useState } from 'react';
import {
  isUsageServiceId,
  normalizeUsageServiceBase,
  usageServiceApi,
  type ManagerConfig,
} from '@/services/api/usageService';
// import { isDemoMode } from '@/features/demo/demoMode';
import { useAuthStore } from '@/stores';
import { detectApiBaseFromLocation } from '@/utils/connection';

export type PanelHostMode = 'manager_embedded' | 'external_panel';

export type PanelFeatureUnavailableReason =
  | 'checking'
  | 'service_not_configured'
  | 'service_unavailable'
  | 'monitoring_disabled';

export interface PanelFeatureAvailability {
  checking: boolean;
  panelHostMode: PanelHostMode;
  panelBase: string;
  managerServiceBase: string;
  managerServiceAvailable: boolean;
  requestMonitoringAvailable: boolean;
  modelPricesAvailable: boolean;
  serverCodexInspectionAvailable: boolean;
  dockerSetupAvailable: boolean;
  externalManagerConfigAvailable: boolean;
  reason: PanelFeatureUnavailableReason | '';
}

export interface ResolvePanelFeatureAvailabilityInput {
  checking?: boolean;
  panelHostedByUsageService: boolean;
  panelBase: string;
  managerServiceBase: string;
  managerConfig: ManagerConfig | null;
  integratedUsageService?: boolean;
  hasManagerCandidate: boolean;
  managementKey: string;
}

const normalizeBase = (value?: string) => normalizeUsageServiceBase(value || '');

const buildUnavailableState = (
  input: ResolvePanelFeatureAvailabilityInput,
  reason: PanelFeatureUnavailableReason
): PanelFeatureAvailability => ({
  checking: input.checking === true,
  panelHostMode: input.panelHostedByUsageService ? 'manager_embedded' : 'external_panel',
  panelBase: normalizeBase(input.panelBase),
  managerServiceBase: '',
  managerServiceAvailable: false,
  requestMonitoringAvailable: false,
  modelPricesAvailable: false,
  serverCodexInspectionAvailable: false,
  dockerSetupAvailable: input.panelHostedByUsageService,
  externalManagerConfigAvailable: false,
  reason,
});

export function resolvePanelFeatureAvailability(
  input: ResolvePanelFeatureAvailabilityInput
): PanelFeatureAvailability {
  if (!input.managementKey) {
    return buildUnavailableState(input, 'service_not_configured');
  }

  const managerServiceBase = normalizeBase(input.managerServiceBase);
  if (!managerServiceBase || !input.managerConfig) {
    return buildUnavailableState(
      input,
      input.hasManagerCandidate ? 'service_unavailable' : 'service_not_configured'
    );
  }

  const integratedUsageService = input.integratedUsageService === true;
  const hasCPAConnection = integratedUsageService
    ? true
    : Boolean(
        input.managerConfig.cpaConnection?.cpaBaseUrl &&
          input.managerConfig.cpaConnection?.managementKey
      );
  const collectorEnabled = input.managerConfig.collector?.enabled !== false;
  const requestMonitoringAvailable = hasCPAConnection && collectorEnabled;

  return {
    checking: input.checking === true,
    panelHostMode: input.panelHostedByUsageService ? 'manager_embedded' : 'external_panel',
    panelBase: normalizeBase(input.panelBase),
    managerServiceBase,
    managerServiceAvailable: true,
    requestMonitoringAvailable,
    modelPricesAvailable: true,
    serverCodexInspectionAvailable: true,
    dockerSetupAvailable: input.panelHostedByUsageService,
    externalManagerConfigAvailable: false,
    reason: requestMonitoringAvailable
      ? ''
      : !hasCPAConnection
        ? 'service_not_configured'
        : 'monitoring_disabled',
  };
}

export interface BuildPanelManagerServiceCandidatesInput {
  panelHostedByUsageService: boolean;
  panelBase: string;
  apiBase: string;
}

export function buildPanelManagerServiceCandidates({
  panelHostedByUsageService,
  panelBase,
  apiBase,
}: BuildPanelManagerServiceCandidatesInput): string[] {
  const normalizedPanelBase = normalizeBase(panelBase);
  if (panelHostedByUsageService) {
    return normalizedPanelBase ? [normalizedPanelBase] : [];
  }

  // External panel mode: use user-configured apiBase as the manager service candidate.
  // The user explicitly set this address at login — it's both the CPA management API
  // and (in integrated mode) the usage service endpoint.
  const normalizedApiBase = normalizeBase(apiBase);
  return normalizedApiBase ? [normalizedApiBase] : [];
}

export function managerConfigMatchesPanel({
  panelHostedByUsageService: _panelHostedByUsageService,
}: {
  panelHostedByUsageService: boolean;
  apiBase: string;
  config: ManagerConfig;
}): boolean {
  // For embedded mode, panel is always matched.
  // For external panel mode, the user explicitly configured this connection,
  // so we trust the config matches.
  return true;
}

type PanelFeatureAvailabilityRequestInput = {
  apiBase: string;
  managementKey: string;
  usageServiceRevision: number;
  panelBase: string;
};

type PanelFeatureAvailabilityRequest = {
  key: string;
  promise: Promise<PanelFeatureAvailability>;
};

const initialAvailability: PanelFeatureAvailability = {
  checking: true,
  panelHostMode: 'external_panel',
  panelBase: '',
  managerServiceBase: '',
  managerServiceAvailable: false,
  requestMonitoringAvailable: false,
  modelPricesAvailable: false,
  serverCodexInspectionAvailable: false,
  dockerSetupAvailable: false,
  externalManagerConfigAvailable: false,
  reason: 'checking',
};

const demoAvailability: PanelFeatureAvailability = {
  checking: false,
  panelHostMode: 'manager_embedded',
  panelBase: '',
  managerServiceBase: '',
  managerServiceAvailable: true,
  requestMonitoringAvailable: true,
  modelPricesAvailable: true,
  serverCodexInspectionAvailable: true,
  dockerSetupAvailable: true,
  externalManagerConfigAvailable: false,
  reason: '',
};

let cachedAvailabilityKey = '';
let cachedAvailability: PanelFeatureAvailability | null = null;
let inFlightAvailabilityRequest: PanelFeatureAvailabilityRequest | null = null;
let latestAvailabilityRequestKey = '';

const isReusableAvailabilityCache = (
  availability: PanelFeatureAvailability | null
): availability is PanelFeatureAvailability =>
  Boolean(
    availability &&
      !availability.checking &&
      availability.managerServiceAvailable &&
      availability.requestMonitoringAvailable &&
      availability.reason === ''
  );

const buildAvailabilityRequestKey = ({
  apiBase,
  managementKey,
  usageServiceRevision,
  panelBase,
}: PanelFeatureAvailabilityRequestInput): string =>
  [
    normalizeBase(panelBase),
    normalizeBase(apiBase),
    managementKey,
    String(usageServiceRevision),
  ].join('\u001f');

async function detectPanelFeatureAvailability({
  apiBase,
  managementKey,
  panelBase,
}: PanelFeatureAvailabilityRequestInput): Promise<PanelFeatureAvailability> {
  const normalizedPanelBase = normalizeBase(panelBase);
  if (!managementKey) {
    return resolvePanelFeatureAvailability({
      checking: false,
      panelHostedByUsageService: false,
      panelBase: normalizedPanelBase,
      managerServiceBase: '',
      managerConfig: null,
      hasManagerCandidate: false,
      managementKey,
    });
  }

  const panelHostedByUsageService = await usageServiceApi
    .getInfo(normalizedPanelBase)
    .then((info) => isUsageServiceId(info.service))
    .catch(() => false);

  const candidates = buildPanelManagerServiceCandidates({
    panelHostedByUsageService,
    panelBase: normalizedPanelBase,
    apiBase,
  });

  for (const candidate of candidates) {
    try {
      const info = await usageServiceApi.getInfo(candidate);
      if (!isUsageServiceId(info.service)) continue;
      const response = await usageServiceApi.getManagerConfig(candidate, managementKey);
      const integratedUsageService =
        response.source === 'integrated' &&
        info.configured !== false &&
        info.adminReady !== false;
      if (
        !managerConfigMatchesPanel({
          panelHostedByUsageService,
          apiBase,
          config: response.config,
        })
      ) {
        continue;
      }
      return resolvePanelFeatureAvailability({
        checking: false,
        panelHostedByUsageService,
        panelBase: normalizedPanelBase,
        managerServiceBase: candidate,
        managerConfig: response.config,
        integratedUsageService,
        hasManagerCandidate: candidates.length > 0,
        managementKey,
      });
    } catch {
      // Continue probing; a regular CPA endpoint or unreachable Manager Server is expected here.
    }
  }

  const unavailableState = resolvePanelFeatureAvailability({
    checking: false,
    panelHostedByUsageService,
    panelBase: normalizedPanelBase,
    managerServiceBase: '',
    managerConfig: null,
    hasManagerCandidate: candidates.length > 0,
    managementKey,
  });
  return unavailableState;
}

function requestPanelFeatureAvailability(
  input: PanelFeatureAvailabilityRequestInput
): { key: string; promise: Promise<PanelFeatureAvailability> } {
  const key = buildAvailabilityRequestKey(input);
  if (cachedAvailabilityKey === key && isReusableAvailabilityCache(cachedAvailability)) {
    return { key, promise: Promise.resolve(cachedAvailability) };
  }
  if (inFlightAvailabilityRequest?.key === key) {
    return inFlightAvailabilityRequest;
  }

  latestAvailabilityRequestKey = key;
  const promise = detectPanelFeatureAvailability(input).then((availability) => {
    if (latestAvailabilityRequestKey === key) {
      if (isReusableAvailabilityCache(availability)) {
        cachedAvailabilityKey = key;
        cachedAvailability = availability;
      } else if (cachedAvailabilityKey === key) {
        cachedAvailabilityKey = '';
        cachedAvailability = null;
      }
    }
    return availability;
  });
  inFlightAvailabilityRequest = { key, promise };
  promise.finally(() => {
    if (inFlightAvailabilityRequest?.key === key) {
      inFlightAvailabilityRequest = null;
    }
  });
  return inFlightAvailabilityRequest;
}

export function usePanelFeatureAvailability(): PanelFeatureAvailability {
  const demoMode = false;
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const panelBase = useMemo(() => detectApiBaseFromLocation(), []);
  const requestInput = useMemo(
    () => ({
      apiBase,
      managementKey,
      usageServiceRevision: 0,
      panelBase,
    }),
    [apiBase, managementKey, panelBase]
  );
  const requestKey = useMemo(
    () => buildAvailabilityRequestKey(requestInput),
    [requestInput]
  );
  const [state, setState] = useState<PanelFeatureAvailability>(() =>
    demoMode
      ? demoAvailability
      : cachedAvailabilityKey === requestKey && isReusableAvailabilityCache(cachedAvailability)
        ? cachedAvailability
        : initialAvailability
  );

  useEffect(() => {
    let cancelled = false;
    if (demoMode) {
      return () => {
        cancelled = true;
      };
    }

    const hasCachedAvailability =
      cachedAvailabilityKey === requestKey && isReusableAvailabilityCache(cachedAvailability);
    if (!hasCachedAvailability) {
      queueMicrotask(() => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          checking: true,
          panelBase: normalizeBase(panelBase),
          reason: 'checking',
        }));
      });
    }

    const request = requestPanelFeatureAvailability(requestInput);
    request.promise.then((availability) => {
      if (cancelled || request.key !== requestKey) return;
      setState(availability);
    });

    return () => {
      cancelled = true;
    };
  }, [
    panelBase,
    demoMode,
    requestInput,
    requestKey,
  ]);

  return demoMode ? demoAvailability : state;
}
