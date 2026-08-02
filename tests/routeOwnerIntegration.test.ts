import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const readProjectFile = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

const mainRoutes = readProjectFile('src/router/MainRoutes.tsx');
const mainLayout = readProjectFile('src/components/layout/MainLayout.tsx');
const appShell = readProjectFile('src/App.tsx');
const protectedRoute = readProjectFile('src/router/ProtectedRoute.tsx');

const plannedRouteOwners = [
  {
    path: '/',
    component: 'DashboardPage',
    importPath: '@/features/dashboard/DashboardPage',
    navPath: '/',
  },
  {
    path: '/dashboard',
    component: 'DashboardPage',
    importPath: '@/features/dashboard/DashboardPage',
  },
  {
    path: '/auth-files',
    component: 'AuthFilesPage',
    importPath: '@/features/authFiles/AuthFilesPage',
    navPath: '/auth-files',
  },
  {
    path: '/quota',
    component: 'QuotaPage',
    importPath: '@/features/quota/QuotaPage',
    navPath: '/quota',
  },
  {
    path: '/ai-providers',
    component: 'ProvidersWorkbenchPage',
    importPath: '@/features/providers/ProvidersWorkbenchPage',
    navPath: '/ai-providers',
  },
  {
    path: '/monitoring',
    component: 'MonitoringCenterPage',
    importPath: '@/features/monitoring/MonitoringCenterPage',
    navPath: '/monitoring',
  },
  {
    path: '/usage',
    component: 'UsageAnalyticsPage',
    importPath: '@/features/usage-analytics/UsageAnalyticsPage',
    navPath: '/usage',
  },
  {
    path: '/prices',
    component: 'ModelPricesPage',
    importPath: '@/features/monitoring/ModelPricesPage',
    navPath: '/prices',
  },
  {
    path: '/actions',
    component: 'AccountActionCandidatesPage',
    importPath: '@/features/monitoring/AccountActionCandidatesPage',
    navPath: '/actions',
  },
  {
    path: '/logs',
    component: 'LogsPage',
    importPath: '@/pages/LogsPage',
    navPath: '/logs',
  },
] as const;

const navigationKeys = [
  'monitoring',
  'usage_analytics',
  'model_prices',
  'account_actions',
] as const;

const providerDeepLinks = [
  ['openai', 'openaiCompatibility'],
  ['claudeapi', 'claudeApi'],
  ['code0', 'code0'],
  ['fennoai', 'fennoAI'],
  ['qiniu', 'qiniuCloud'],
  ['lmuai', 'lmuAI'],
  ['kimi', 'kimi'],
  ['opencode-go', 'opencodeGo'],
] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countLiteralRoutePaths = (path: string): number =>
  Array.from(mainRoutes.matchAll(new RegExp(`path: '${escapeRegExp(path)}'`, 'g'))).length;

describe('route owner integration', () => {
  test('planned routes point to current feature owners without duplicate concrete paths', () => {
    for (const owner of plannedRouteOwners) {
      expect(mainRoutes).toContain(`import { ${owner.component} } from '${owner.importPath}';`);
      expect(mainRoutes).toContain(`{ path: '${owner.path}', element: <${owner.component}`);
      expect(countLiteralRoutePaths(owner.path)).toBe(1);
    }

    expect(mainRoutes).not.toContain("@/pages/DashboardPage");
    expect(mainRoutes).not.toContain("@/pages/AuthFilesPage");
    expect(mainRoutes).not.toContain("@/pages/QuotaPage");
  });

  test('navigation exposes planned route owners with matching i18n keys', () => {
    for (const owner of plannedRouteOwners) {
      if (!owner.navPath) continue;
      expect(mainLayout).toContain(`path: '${owner.navPath}'`);
    }

    for (const key of navigationKeys) {
      expect(mainLayout).toContain(`labelKey: 'nav.${key}'`);
      expect(mainLayout).toContain(`metaKey: 'nav_meta.${key}'`);
    }

    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru']) {
      const messages = JSON.parse(readProjectFile(`src/i18n/locales/${locale}.json`));
      for (const key of navigationKeys) {
        expect(typeof messages.nav[key]).toBe('string');
        expect(typeof messages.nav_meta[key]).toBe('string');
      }
    }
  });

  test('provider deep links are explicit before provider wildcard redirects', () => {
    expect(mainRoutes.indexOf("path: '/ai-providers/:providerSlug'")).toBeGreaterThanOrEqual(0);
    expect(mainRoutes.indexOf("path: '/ai-providers/:providerSlug'")).toBeLessThan(
      mainRoutes.indexOf("path: '/ai-providers/*'")
    );
    expect(mainRoutes).toContain("path: '/opencode-go'");
    expect(mainRoutes).toContain('<ProvidersWorkbenchPage fixedBrand="opencodeGo" />');

    for (const [slug, brand] of providerDeepLinks) {
      expect(mainRoutes).toMatch(new RegExp(`['"]?${escapeRegExp(slug)}['"]?: '${brand}'`));
    }
  });

  test('main shell remains protected while login stays public', () => {
    expect(appShell).toContain("{ path: '/login', element: <LoginPage /> }");
    expect(appShell).toContain('<ProtectedRoute>');
    expect(appShell).toContain('<MainLayout />');
    expect(protectedRoute).toContain('<Navigate to="/login" replace state={{ from: location }} />');
  });

  test('obsolete page shells and quota component shell are absent after migration', () => {
    for (const path of [
      'src/pages/DashboardPage.tsx',
      'src/pages/AuthFilesPage.tsx',
      'src/pages/QuotaPage.tsx',
      'src/components/quota',
    ]) {
      expect(existsSync(join(repoRoot, path))).toBe(false);
    }
  });
});
