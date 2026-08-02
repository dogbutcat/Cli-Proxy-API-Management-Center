import { Navigate, useParams, useRoutes, type Location } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProvidersWorkbenchPage } from '@/features/providers/ProvidersWorkbenchPage';
import { AuthFilesPage } from '@/features/authFiles/AuthFilesPage';
import { MonitoringCenterPage } from '@/features/monitoring/MonitoringCenterPage';
import { UsageAnalyticsPage } from '@/features/usage-analytics/UsageAnalyticsPage';
import { ModelPricesPage } from '@/features/monitoring/ModelPricesPage';
import { AccountActionCandidatesPage } from '@/features/monitoring/AccountActionCandidatesPage';
import { AuthFilesOAuthExcludedEditPage } from '@/pages/AuthFilesOAuthExcludedEditPage';
import { AuthFilesOAuthModelAliasEditPage } from '@/pages/AuthFilesOAuthModelAliasEditPage';
import { OAuthPage } from '@/pages/OAuthPage';
import { QuotaPage } from '@/features/quota/QuotaPage';
import { PluginResourcePage } from '@/features/plugins/PluginResourcePage';
import { PluginsPage } from '@/features/plugins/PluginsPage';
import { PluginStorePage } from '@/features/plugins/PluginStorePage';
import { ConfigPage } from '@/features/config/ConfigPage';
import { LogsPage } from '@/pages/LogsPage';
import { SystemPage } from '@/pages/SystemPage';
import { useAuthStore } from '@/stores';
import type { ProviderBrand } from '@/features/providers/types';

const providerDeepLinkBrandBySlug: Record<string, ProviderBrand> = {
  kimi: 'kimi',
  gemini: 'gemini',
  interactions: 'interactions',
  codex: 'codex',
  xai: 'xai',
  claude: 'claude',
  vertex: 'vertex',
  openai: 'openaiCompatibility',
  'opencode-go': 'opencodeGo',
  apikeyfun: 'apikeyFun',
  claudeapi: 'claudeApi',
  code0: 'code0',
  fennoai: 'fennoAI',
  qiniu: 'qiniuCloud',
  lmuai: 'lmuAI',
};

function ProviderDeepLinkPage() {
  const { providerSlug } = useParams();
  const fixedBrand = providerSlug
    ? providerDeepLinkBrandBySlug[providerSlug.toLowerCase()]
    : undefined;

  return fixedBrand ? (
    <ProvidersWorkbenchPage fixedBrand={fixedBrand} />
  ) : (
    <Navigate to="/ai-providers" replace />
  );
}

const createMainRoutes = (supportsPlugin: boolean) => [
  { path: '/', element: <DashboardPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/settings', element: <Navigate to="/config" replace /> },
  { path: '/api-keys', element: <Navigate to="/config" replace /> },
  { path: '/quick-start', element: <ProvidersWorkbenchPage fixedBrand="apikeyFun" /> },
  { path: '/quick-start/*', element: <Navigate to="/quick-start" replace /> },
  { path: '/ai-providers', element: <ProvidersWorkbenchPage /> },
  { path: '/ai-providers/:providerSlug', element: <ProviderDeepLinkPage /> },
  { path: '/opencode-go', element: <ProvidersWorkbenchPage fixedBrand="opencodeGo" /> },
  { path: '/ai-providers/*', element: <Navigate to="/ai-providers" replace /> },
  { path: '/auth-files', element: <AuthFilesPage /> },
  { path: '/auth-files/oauth-excluded', element: <AuthFilesOAuthExcludedEditPage /> },
  { path: '/auth-files/oauth-model-alias', element: <AuthFilesOAuthModelAliasEditPage /> },
  { path: '/oauth', element: <OAuthPage /> },
  { path: '/quota', element: <QuotaPage /> },
  { path: '/monitoring', element: <MonitoringCenterPage /> },
  { path: '/usage', element: <UsageAnalyticsPage /> },
  { path: '/prices', element: <ModelPricesPage /> },
  { path: '/actions', element: <AccountActionCandidatesPage /> },
  ...(supportsPlugin
    ? [
        { path: '/plugin-pages/:pluginId/:menuIndex', element: <PluginResourcePage /> },
        { path: '/plugins', element: <PluginsPage /> },
        { path: '/plugin-store', element: <PluginStorePage /> },
        { path: '/plugins/*', element: <Navigate to="/plugins" replace /> },
      ]
    : [
        { path: '/plugin-pages/*', element: <Navigate to="/" replace /> },
        { path: '/plugins/*', element: <Navigate to="/" replace /> },
        { path: '/plugin-store', element: <Navigate to="/" replace /> },
      ]),
  { path: '/config', element: <ConfigPage /> },
  { path: '/logs', element: <LogsPage /> },
  { path: '/system', element: <SystemPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function MainRoutes({ location }: { location?: Location }) {
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  return useRoutes(createMainRoutes(supportsPlugin), location);
}
