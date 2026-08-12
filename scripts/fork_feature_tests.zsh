#!/bin/zsh
source ~/.zshrc >/dev/null 2>&1
setopt aliases
set -e
set -u
set -o pipefail

# Focused fork feature gate for protected FE surfaces.

readonly SCRIPT_DIR=${0:A:h}
readonly REPO_ROOT=${SCRIPT_DIR:h}

fork_feature_tests=(
	tests/monitoringAnalyticsRequestContract.test.ts
	tests/monitoringFeatureContracts.test.ts
	tests/monitoringSourceIdentity.test.ts
	tests/usageAnalyticsContract.test.ts
	tests/dashboardMetrics.test.ts
	tests/dashboardModelsState.test.ts
	tests/accountActionsCapability.test.ts
	tests/modelPricesStates.test.ts
	tests/usageImportSession.test.ts
	tests/opencodeGoProviderWorkbench.test.ts
	tests/opencodeGoQuotaAdapter.test.ts
	tests/opencodeGoQuotaBody.test.ts
	tests/opencodeGoQuotaGroups.test.ts
	tests/opencodeGoQuotaNormalize.test.ts
	tests/logsOpenCodeDiscoverability.test.ts
	tests/routeOwnerIntegration.test.ts
	tests/visualConfigRoutingStrategy.test.ts
	tests/quotaTimeline.test.ts
	tests/quotaPageLogic.test.ts
	tests/claudeProviderDualMode.test.ts
)

cd "$REPO_ROOT"
bun test "${fork_feature_tests[@]}"
