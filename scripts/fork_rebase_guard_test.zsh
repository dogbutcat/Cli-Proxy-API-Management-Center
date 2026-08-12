#!/bin/zsh
source ~/.zshrc >/dev/null 2>&1
setopt aliases
set -e
set -u
set -o pipefail

# Self-test the fork rebase guard against a disposable Git repository.

readonly SCRIPT_DIR=${0:A:h}
readonly GUARD="${SCRIPT_DIR}/fork_rebase_guard.zsh"
readonly TMP_ROOT=$(mktemp -d)
readonly REPO="${TMP_ROOT}/repo"

cleanup() {
	rm -rf -- "$TMP_ROOT"
}
trap cleanup EXIT

expect_pass() {
	local label=$1
	shift
	if ! "$@" >"${TMP_ROOT}/output.log" 2>&1; then
		print -u2 -- "FAIL: ${label} should pass"
		cat "${TMP_ROOT}/output.log" >&2
		exit 1
	fi
	print -- "PASS: ${label}"
}

expect_fail() {
	local label=$1
	shift
	if "$@" >"${TMP_ROOT}/output.log" 2>&1; then
		print -u2 -- "FAIL: ${label} should fail"
		cat "${TMP_ROOT}/output.log" >&2
		exit 1
	fi
	print -- "PASS: ${label} rejected"
}

write_fixture() {
	mkdir -p \
		"$REPO/audit/contracts" \
		"$REPO/audit/gates" \
		"$REPO/scripts" \
		"$REPO/src/components/config" \
		"$REPO/src/components/layout" \
		"$REPO/src/features/dashboard" \
		"$REPO/src/features/logs" \
		"$REPO/src/features/monitoring" \
		"$REPO/src/features/providers/sheets/forms" \
		"$REPO/src/features/quota/providers/opencodeGo" \
		"$REPO/src/features/usage-analytics" \
		"$REPO/src/hooks" \
		"$REPO/src/i18n/locales" \
		"$REPO/src/router" \
		"$REPO/src/services/api" \
		"$REPO/src/types" \
		"$REPO/src/utils" \
		"$REPO/tests"

	print -- 'Repository Guidelines' >"$REPO/AGENTS.md"
	print -- '{"scripts":{"verify:fork":"zsh scripts/fork_feature_tests.zsh","guard:rebase":"zsh scripts/fork_rebase_guard.zsh","guard:selftest":"zsh scripts/fork_rebase_guard_test.zsh"}}' >"$REPO/package.json"
	print -- '#!/bin/zsh' >"$REPO/scripts/fork_feature_tests.zsh"
	print -- '#!/bin/zsh' >"$REPO/scripts/fork_rebase_guard.zsh"
	print -- '#!/bin/zsh' >"$REPO/scripts/fork_rebase_guard_test.zsh"
	{
		print -- $'# surface\tmode\tpathspec'
		print -- $'fork-policy\tpreserve\tAGENTS.md'
		print -- $'rebase-guard\tpreserve\tscripts/fork_protected_surfaces.tsv'
		print -- $'rebase-guard\tpreserve\tscripts/fork_feature_tests.zsh'
		print -- $'route-owners\tpresence\tsrc/router/MainRoutes.tsx'
		print -- $'seq-random\tpreserve\tsrc/utils/routingStrategy.ts'
		print -- $'monitoring\tpreserve\tsrc/features/monitoring'
	} >"$REPO/scripts/fork_protected_surfaces.tsv"

	print -- "path: '/monitoring' path: '/usage' path: '/prices' path: '/actions' path: '/opencode-go' path: '/ai-providers/:providerSlug' fixedBrand=\"opencodeGo\"" >"$REPO/src/router/MainRoutes.tsx"
	{
		print -- "import { ConfigPage } from '@/pages/ConfigPage';"
		print -- "const providerDeepLinkBrandBySlug = { 'opencode-go': 'opencodeGo' };"
		print -- "path: '/monitoring'"
		print -- "path: '/usage'"
		print -- "path: '/prices'"
		print -- "path: '/actions'"
		print -- "path: '/opencode-go'"
		print -- "path: '/ai-providers/:providerSlug'"
		print -- "fixedBrand=\"opencodeGo\""
		print -- "path: '/ai-providers/*'"
		print -- "path: '/config'"
	} >"$REPO/src/router/MainRoutes.tsx"
	print -- 'nav monitoring usage_analytics model_prices account_actions' >"$REPO/src/components/layout/MainLayout.tsx"
	print -- "seqrandom sequentialrandom sr: 'seq-random'" >"$REPO/src/utils/routingStrategy.ts"
	print -- "export function getRoutingStrategyOptions() { return ['seq-random']; }" >"$REPO/src/features/dashboard/utils.ts"
	print -- 'getRoutingStrategyOptions' >"$REPO/src/components/config/VisualConfigEditor.tsx"
	print -- '/usage/monitoring/analytics /usage/dashboard/summary api_key_hash source_hash' >"$REPO/src/services/api/usageService.ts"
	print -- 'api_key_hash source_hash monitoring' >"$REPO/src/features/monitoring/index.ts"
	print -- 'api_key_hash source_hash usage' >"$REPO/src/features/usage-analytics/index.ts"
	print -- 'export const buildUsageHeatmapSummaryCards = () => computeCacheHitRate(summary) && "usage_analytics.cache_read_rate"' >"$REPO/src/features/usage-analytics/usageAnalyticsPresentation.ts"
	print -- 'opencodeGo opencode-go x-api-key Qwen' >"$REPO/src/services/api/opencodeGo.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/types/opencodeGo.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/descriptors.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/adapters.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/brandLogos.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/types.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/useProviderWorkbench.ts"
	print -- 'x-api-key' >"$REPO/src/features/providers/sheets/forms/useConnectivityTest.ts"
	print -- 'opencodeGo opencode-go' >"$REPO/src/features/providers/sheets/forms/OpenCodeGoGroupedForm.tsx"
	print -- "provider === 'codex' opencode-go" >"$REPO/src/features/quota/quotaTimelineModel.ts"
	print -- 'opencode-go' >"$REPO/src/features/quota/providers/index.ts"
	print -- 'opencode-go' >"$REPO/src/features/quota/providers/opencodeGo/data.ts"
	print -- 'logs opencode-go' >"$REPO/src/features/logs/logFeatureAvailability.ts"
	for locale in en zh-CN zh-TW ru; do
		print -- '{}' >"$REPO/src/i18n/locales/${locale}.json"
	done
	for test_file in \
		routeOwnerIntegration.test.ts \
		visualConfigRoutingStrategy.test.ts \
		monitoringAnalyticsRequestContract.test.ts \
		monitoringFeatureContracts.test.ts \
		monitoringSourceIdentity.test.ts \
		usageAnalyticsContract.test.ts \
		dashboardMetrics.test.ts \
		dashboardModelsState.test.ts \
		accountActionsCapability.test.ts \
		modelPricesStates.test.ts \
		usageImportSession.test.ts \
		opencodeGoProviderWorkbench.test.ts \
		opencodeGoQuotaAdapter.test.ts \
		opencodeGoQuotaBody.test.ts \
		opencodeGoQuotaGroups.test.ts \
		opencodeGoQuotaNormalize.test.ts \
		logsOpenCodeDiscoverability.test.ts \
		quotaTimeline.test.ts \
		quotaPageLogic.test.ts \
		claudeProviderDualMode.test.ts; do
		print -- 'test fixture' >"$REPO/tests/${test_file}"
	done
	print -- '{}' >"$REPO/audit/contracts/fe_real_be_smoke.json"
	print -- '{}' >"$REPO/audit/gates/g5_fe_gate.json"
}

git init -q "$REPO"
git -C "$REPO" config user.name ForkGuardTest
git -C "$REPO" config user.email fork-guard@example.invalid
write_fixture
git -C "$REPO" add .
git -C "$REPO" commit -qm base
base=$(git -C "$REPO" rev-parse HEAD)

expect_pass "unchanged protected surfaces" zsh "$GUARD" check "$base" HEAD "$REPO"

rm "$REPO/AGENTS.md"
git -C "$REPO" add -u
git -C "$REPO" commit -qm remove-policy
expect_fail "removed exact surface" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
rm "$REPO/src/features/monitoring/index.ts"
git -C "$REPO" add -u
git -C "$REPO" commit -qm remove-monitoring-member
expect_fail "removed directory member" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
{
	print -- "import { ConfigPage } from '@/pages/ConfigPage';"
	print -- "const providerDeepLinkBrandBySlug = { 'opencode-go': 'opencodeGo' };"
	print -- "path: '/monitoring'"
	print -- "path: '/prices'"
	print -- "path: '/actions'"
	print -- "path: '/opencode-go'"
	print -- "path: '/ai-providers/:providerSlug'"
	print -- "fixedBrand=\"opencodeGo\""
	print -- "path: '/ai-providers/*'"
	print -- "path: '/config'"
} >"$REPO/src/router/MainRoutes.tsx"
git -C "$REPO" add src/router/MainRoutes.tsx
git -C "$REPO" commit -qm break-usage-route
expect_fail "semantic route deletion" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
{
	print -- "import { ConfigPage } from '@/pages/ConfigPage';"
	print -- "path: '/ai-providers/*'"
	print -- "const providerDeepLinkBrandBySlug = { 'opencode-go': 'opencodeGo' };"
	print -- "path: '/ai-providers/:providerSlug'"
	print -- "path: '/monitoring'"
	print -- "path: '/usage'"
	print -- "path: '/prices'"
	print -- "path: '/actions'"
	print -- "path: '/opencode-go'"
	print -- "fixedBrand=\"opencodeGo\""
	print -- "path: '/config'"
} >"$REPO/src/router/MainRoutes.tsx"
git -C "$REPO" add src/router/MainRoutes.tsx
git -C "$REPO" commit -qm break-route-order
expect_fail "semantic route order regression" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
print -- 'legacy config editor without routing helper' >"$REPO/src/components/config/VisualConfigEditor.tsx"
git -C "$REPO" add src/components/config/VisualConfigEditor.tsx
git -C "$REPO" commit -qm break-config-routing
expect_fail "semantic config routing disconnect" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
print -- 'connectivity without anthropic api key header' >"$REPO/src/features/providers/sheets/forms/useConnectivityTest.ts"
git -C "$REPO" add src/features/providers/sheets/forms/useConnectivityTest.ts
git -C "$REPO" commit -qm break-opencode-auth
expect_fail "semantic opencode auth deletion" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
print -- 'export const buildUsageHeatmapSummaryCards = () => []' >"$REPO/src/features/usage-analytics/usageAnalyticsPresentation.ts"
git -C "$REPO" add src/features/usage-analytics/usageAnalyticsPresentation.ts
git -C "$REPO" commit -qm break-usage-analytics-cache-card
expect_fail "semantic usage analytics cache card deletion" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
mkdir -p "$REPO/src/features/config/components/blocks"
print -- 'export const evaluateApiKeyStrength = () => ({})' >"$REPO/src/utils/apiKeyStrength.ts"
print -- 'export const ApiKeyStrengthMeter = () => null' >"$REPO/src/features/config/components/blocks/ApiKeyStrengthMeter.tsx"
print -- 'api key card without strength meter' >"$REPO/src/features/config/components/blocks/ApiKeysCardEditor.tsx"
git -C "$REPO" add src/utils/apiKeyStrength.ts src/features/config/components/blocks
git -C "$REPO" commit -qm incomplete-api-key-strength
expect_fail "optional api key strength disconnect" zsh "$GUARD" check "$base" HEAD "$REPO"

git -C "$REPO" reset --hard -q "$base"
print -- 'export const buildInfistarRaw = () => ({})' >"$REPO/src/features/providers/infistar.ts"
print -- 'infistar' >"$REPO/src/features/providers/adapters.ts"
print -- 'infistar' >"$REPO/src/features/providers/useProviderWorkbench.ts"
git -C "$REPO" add src/features/providers/infistar.ts src/features/providers/adapters.ts src/features/providers/useProviderWorkbench.ts
git -C "$REPO" commit -qm incomplete-infistar
expect_fail "optional infistar provider disconnect" zsh "$GUARD" check "$base" HEAD "$REPO"
