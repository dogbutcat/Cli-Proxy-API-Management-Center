#!/bin/zsh
source ~/.zshrc >/dev/null 2>&1
setopt aliases
set -e
set -u
set -o pipefail

# Guard fork-owned FE surfaces after rebasing onto upstream cpa/main.

readonly MANIFEST_PATH="scripts/fork_protected_surfaces.tsv"

usage() {
	print -u2 -- "Usage: fork_rebase_guard.zsh check <before-ref> [after-ref] [repo]"
}

list_paths() {
	local repo=$1
	local ref=$2
	local pathspec=$3
	git -C "$repo" ls-tree -r --name-only "$ref" -- "$pathspec" | LC_ALL=C sort
}

require_grep() {
	local repo=$1
	local ref=$2
	local label=$3
	local needle=$4
	shift 4

	if git -C "$repo" grep -q -F -- "$needle" "$ref" -- "$@" 2>/dev/null; then
		return 0
	fi

	print -u2 -- "SEMANTIC_MISSING [${label}] ${needle}"
	return 1
}

require_grep_regex() {
	local repo=$1
	local ref=$2
	local label=$3
	local pattern=$4
	shift 4

	if git -C "$repo" grep -q -E -- "$pattern" "$ref" -- "$@" 2>/dev/null; then
		return 0
	fi

	print -u2 -- "SEMANTIC_MISSING [${label}] ${pattern}"
	return 1
}

require_in_order() {
	local repo=$1
	local ref=$2
	local label=$3
	local target_path=$4
	local first=$5
	local second=$6

	if git -C "$repo" show "${ref}:${target_path}" |
		awk -v first="$first" -v second="$second" '
			index($0, first) && first_line == 0 { first_line = NR }
			index($0, second) && second_line == 0 { second_line = NR }
			END { exit !(first_line > 0 && second_line > 0 && first_line < second_line) }
		'; then
		return 0
	fi

	print -u2 -- "ORDER_INVALID [${label}] ${target_path}: ${first} must appear before ${second}"
	return 1
}

path_exists_at_ref() {
	local repo=$1
	local ref=$2
	local tree_path=$3
	git -C "$repo" cat-file -e "${ref}:${tree_path}" 2>/dev/null
}

check_semantics() {
	local repo=$1
	local ref=$2
	local failures=0
	local config_hits

	require_grep "$repo" "$ref" "routes" "path: '/config'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/monitoring'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/usage'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/prices'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/actions'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/opencode-go'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "path: '/ai-providers/:providerSlug'" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep "$repo" "$ref" "routes" "fixedBrand=\"opencodeGo\"" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_grep_regex "$repo" "$ref" "routes" "import \\{ ConfigPage \\} from '@/((pages)|(features/config))/ConfigPage';" src/router/MainRoutes.tsx || (( failures += 1 ))
	require_in_order "$repo" "$ref" "routes" src/router/MainRoutes.tsx "path: '/ai-providers/:providerSlug'" "path: '/ai-providers/*'" || (( failures += 1 ))

	require_grep "$repo" "$ref" "seq-random" "'seq-random'" src/utils/routingStrategy.ts src/features/dashboard/utils.ts || (( failures += 1 ))
	require_grep "$repo" "$ref" "seq-random" "sequentialrandom" src/utils/routingStrategy.ts || (( failures += 1 ))
	require_grep "$repo" "$ref" "seq-random" "sr:" src/utils/routingStrategy.ts || (( failures += 1 ))
	config_hits=$(
		git -C "$repo" grep -l -F -- "getRoutingStrategyOptions" "$ref" -- \
			src/components/config src/features/config src/pages/ConfigPage.tsx 2>/dev/null || true
	)
	if [[ -z "$config_hits" ]]; then
		print -u2 -- "SEMANTIC_MISSING [seq-random] active config UI does not use getRoutingStrategyOptions"
		(( failures += 1 ))
	fi

	require_grep "$repo" "$ref" "usage-api" "/usage/monitoring/analytics" src/services/api/usageService.ts || (( failures += 1 ))
	require_grep "$repo" "$ref" "usage-api" "/usage/dashboard/summary" src/services/api/usageService.ts || (( failures += 1 ))
	require_grep "$repo" "$ref" "usage-api" "api_key_hash" src/services/api/usageService.ts src/features/usage-analytics src/features/monitoring || (( failures += 1 ))
	require_grep "$repo" "$ref" "usage-api" "source_hash" src/services/api/usageService.ts src/features/usage-analytics src/features/monitoring || (( failures += 1 ))

	require_grep "$repo" "$ref" "opencode-go" "opencodeGo" src/features/providers src/features/quota src/services/api src/types || (( failures += 1 ))
	require_grep "$repo" "$ref" "opencode-go" "opencode-go" src/features/providers src/features/quota src/services/api src/types || (( failures += 1 ))
	require_grep "$repo" "$ref" "opencode-go" "x-api-key" src/features/providers/sheets/forms/useConnectivityTest.ts || (( failures += 1 ))
	require_in_order "$repo" "$ref" "opencode-go" src/router/MainRoutes.tsx "'opencode-go': 'opencodeGo'" "path: '/ai-providers/*'" || (( failures += 1 ))

	if path_exists_at_ref "$repo" "$ref" src/features/providers/infistar.ts; then
		require_grep "$repo" "$ref" "infistar" "infistarToResource" src/features/providers/adapters.ts src/features/providers/useProviderWorkbench.ts || (( failures += 1 ))
		require_grep "$repo" "$ref" "infistar" "buildInfistarRaw" src/features/providers/useProviderWorkbench.ts src/features/providers/infistar.ts || (( failures += 1 ))
		require_grep "$repo" "$ref" "infistar" "infistar" src/features/providers/brandLogos.ts src/features/providers/descriptors.ts src/features/providers/types.ts src/router/MainRoutes.tsx || (( failures += 1 ))
		require_grep "$repo" "$ref" "infistar" "/ai-providers/infistar" src/features/providers/sheets/ProviderSheet.tsx src/router/MainRoutes.tsx || (( failures += 1 ))
	fi

	if path_exists_at_ref "$repo" "$ref" src/utils/apiKeyStrength.ts; then
		require_grep "$repo" "$ref" "api-key-strength" "evaluateApiKeyStrength" src/utils/apiKeyStrength.ts src/features/config/components/blocks/ApiKeyStrengthMeter.tsx src/features/config/components/blocks/ApiKeysCardEditor.tsx || (( failures += 1 ))
		require_grep "$repo" "$ref" "api-key-strength" "ApiKeyStrengthMeter" src/features/config/components/blocks/ApiKeyStrengthMeter.tsx src/features/config/components/blocks/ApiKeysCardEditor.tsx || (( failures += 1 ))
		require_grep "$repo" "$ref" "api-key-strength" "config_management.visual.api_keys.strength" src/features/config/components/blocks/ApiKeyStrengthMeter.tsx src/i18n/locales || (( failures += 1 ))
	fi

	require_grep "$repo" "$ref" "quota" "opencode-go" src/features/quota/quotaTimelineModel.ts src/features/quota/providers/index.ts || (( failures += 1 ))
	require_grep_regex "$repo" "$ref" "quota" "provider === 'codex'|provider === \"codex\"" src/features/quota/quotaTimelineModel.ts || (( failures += 1 ))

	require_grep "$repo" "$ref" "package-scripts" "\"verify:fork\"" package.json || (( failures += 1 ))
	require_grep "$repo" "$ref" "package-scripts" "\"guard:rebase\"" package.json || (( failures += 1 ))
	require_grep "$repo" "$ref" "package-scripts" "\"guard:selftest\"" package.json || (( failures += 1 ))

	if (( failures > 0 )); then
		return 1
	fi
	return 0
}

check_surfaces() {
	local before_ref=$1
	local after_ref=$2
	local repo=$3
	local failures=0
	local rows=0
	local surface mode pathspec rest before_paths after_paths removed_path

	git -C "$repo" rev-parse --verify "${before_ref}^{commit}" >/dev/null
	git -C "$repo" rev-parse --verify "${after_ref}^{commit}" >/dev/null
	if ! git -C "$repo" cat-file -e "${before_ref}:${MANIFEST_PATH}" 2>/dev/null; then
		print -u2 -- "Protected-surface manifest is missing from before-ref: ${before_ref}:${MANIFEST_PATH}"
		return 1
	fi

	while IFS=$'\t' read -r surface mode pathspec rest; do
		[[ -z "$surface" || "$surface" == \#* ]] && continue
		(( rows += 1 ))
		if [[ -n "$rest" || -z "$pathspec" || "$mode" != (presence|preserve) ]]; then
			print -u2 -- "Invalid manifest row ${rows}: ${surface}/${mode}/${pathspec}"
			(( failures += 1 ))
			continue
		fi

		before_paths=$(list_paths "$repo" "$before_ref" "$pathspec")
		after_paths=$(list_paths "$repo" "$after_ref" "$pathspec")
		if [[ -z "$after_paths" ]]; then
			print -u2 -- "MISSING [${surface}] ${pathspec}"
			(( failures += 1 ))
			continue
		fi

		if [[ "$mode" == "preserve" && -n "$before_paths" ]]; then
			while IFS= read -r removed_path; do
				[[ -z "$removed_path" ]] && continue
				print -u2 -- "REMOVED [${surface}] ${removed_path}"
				(( failures += 1 ))
			done < <(comm -23 <(print -r -- "$before_paths") <(print -r -- "$after_paths"))
		fi
	done < <(git -C "$repo" show "${before_ref}:${MANIFEST_PATH}")

	if ! check_semantics "$repo" "$after_ref"; then
		(( failures += 1 ))
	fi

	if (( rows == 0 )); then
		print -u2 -- "Protected-surface manifest contains no entries"
		return 1
	fi
	if (( failures > 0 )); then
		print -u2 -- "Fork rebase guard failed with ${failures} protected-surface violation(s)."
		return 1
	fi

	print -- "Fork rebase guard passed: ${rows} protected pathspec(s), ${before_ref} -> ${after_ref}"
}

if (( $# < 2 )) || [[ "$1" != "check" ]]; then
	usage
	exit 2
fi

before_ref=$2
after_ref=${3:-HEAD}
repo=${4:-$PWD}
check_surfaces "$before_ref" "$after_ref" "$repo"
