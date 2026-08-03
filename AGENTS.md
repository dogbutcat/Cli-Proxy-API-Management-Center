# Repository Guidelines

## Project Scope & Structure

This is a React 19 + TypeScript + Vite management frontend for CLI Proxy API, not the proxy itself. It talks to the backend Management API under `/v0/management`.

- `src/features/`: feature-owned pages, components, hooks, types, and logic. Current features include `dashboard`, `providers`, `authFiles`, `quota`, `config`, and `plugins`. Prefer this layout for new feature work.
- `src/pages/`: existing route pages outside the feature layout. Follow nearby conventions when modifying these; do not migrate unrelated code.
- `src/components/`, `src/hooks/`, `src/utils/`: shared UI, hooks, and utilities. Keep feature-specific code within its feature rather than promoting it prematurely.
- `src/services/api/`: API client, domain endpoints, and backend data normalization. `src/services/storage/`: browser persistence.
- `src/stores/`: Zustand state. `src/types/`: shared types. `src/styles/`: global styles and theme tokens.
- `src/App.tsx`: hash-router setup. `src/router/MainRoutes.tsx`: authenticated route table. `ProtectedRoute` and `MainLayout` guard and wrap the authenticated app.
- `src/assets/`: bundled assets, including provider icons in `icons/`.
- `src/i18n/locales/`: `en.json`, `zh-CN.json`, `zh-TW.json`, and `ru.json`; fallback language is `zh-CN`. Update all four files when adding or changing translation keys, including accessible labels.

## Build, Test, and Development Commands

Use Bun; `package.json` pins `bun@1.3.14`, and CI uses Node.js 24. Keep dependency changes consistent with `bun.lock`; do not introduce another package manager's lockfile.

- `bun install --frozen-lockfile`: install locked dependencies.
- `bun run dev`: start Vite at `http://localhost:5173` by default.
- `bun run build`: TypeScript compilation followed by the production Vite build.
- `bun run preview`: serve the built output locally.
- `bun run test`: run all Bun tests.
- `bun test tests/apiError.test.ts`: example focused test run.
- `bun run lint`: run ESLint over TypeScript/TSX files. Some rules emit warnings; the current command does not enforce zero warnings.
- `bun run type-check`: run `tsc --noEmit`; the main TypeScript config includes `src`, not `tests`.
- `bun run verify`: run tests, lint, and build (which includes TypeScript compilation).
- `bun run format`: format all `src/**/*.{ts,tsx,css,scss}`. Prefer targeted formatting of changed files during routine work to avoid unrelated diffs.

## Deployment Constraints

The production artifact is a single `dist/index.html` with JS/CSS and bundled assets inlined by `vite-plugin-singlefile`. The release workflow renames it to `management.html` for backend hosting; `vX.Y.Z` tags trigger releases.

Preserve hash routing and single-file deployment. Changes to assets, imports, code splitting, or build configuration must not introduce required external build artifacts. Do not edit generated `dist/` files. App version is injected as `__APP_VERSION__` from `VERSION`, then git tags, then the package version, falling back to `dev`.

## API Contracts & State

- Treat backend contracts as the source of truth. Inspect `../CLIProxyAPI` before changing endpoint names, payloads, provider keys, OAuth callback parameters, auth-file semantics, or plugin/config contracts. If that checkout is unavailable, report the missing evidence rather than guessing; do not modify the backend unless requested.
- Reuse `apiClient` from `src/services/api/client.ts` for Management API requests through domain modules. It centralizes the API prefix, bearer authentication, error normalization, and response-header handling. Avoid bypassing it with ad hoc requests in components.
- Preserve the client's event integration: `unauthorized` handles 401s, `server-version-update` carries version/build metadata, and `server-plugin-support-update` carries plugin capability information. Keep plugin routes gated by backend support.
- Normalize backend fields on read and serialize on write in the API layer; consult `transformers.ts` and the relevant domain module. Keep raw backend field-name handling out of ordinary UI components.
- `useConfigStore.fetchConfig(forceRefresh?: boolean)` uses a full-config TTL cache and in-flight request deduplication, not section-based fetching. Reuse it where appropriate and invalidate/update caches after mutations using existing store actions.
- Preserve stale-request guards and cache cleanup when switching connections or logging out. Old asynchronous responses must not overwrite the new session's state.
- Provider UI capabilities live in `src/features/providers/descriptors.ts`; `adapters.ts` maps provider configs to the shared resource model. Extend these existing abstractions rather than scattering provider-specific conditionals across components.

## Coding Style & UI Conventions

Use 2-space indentation, semicolons, single quotes, ES5 trailing commas, and 100-character line width. Prefer typed React components and `unknown` with narrowing for untrusted data; avoid introducing `any` unless an unavoidable boundary requires it. Use the `@/` alias for `src` imports.

Component files use PascalCase, hooks use `useName`, and API modules use domain names such as `oauth.ts`. SCSS Modules sit beside their page or component as `Name.module.scss`. Vite automatically injects `src/styles/variables.scss` into SCSS; new modules do not need to import it again. Reuse shared components from `src/components/ui/` and existing theme tokens before adding new primitives or hard-coded colors.

Keep user-facing text in i18n. Preserve keyboard interaction, accessible names, focus behavior, and reduced-motion handling when modifying interactive UI.

## Testing & Verification

Tests are centralized under `tests/` as `*.test.ts` and use `bun:test`. Existing suites cover pure logic, React server-side static rendering via `renderToStaticMarkup`, and source/contract checks. There is no configured browser DOM test harness; static markup tests do not verify browser interactions. Prefer extracting testable logic and following nearby test patterns rather than introducing a new framework by default.

For code changes, add or update relevant regression tests, run focused tests while iterating, and run `bun run verify` before handoff. For UI changes, also verify the affected route in a browser and include screenshots or notes. Report commands actually run, failures, and anything not verified; if a backend or browser is unavailable, state the limitation explicitly. Documentation-only changes can be checked with diff/content validation instead of a full build.

## Security

Never commit real management keys, provider credentials, auth files, or other secrets; redact them from logs, screenshots, and test fixtures. Management keys are entered at runtime and persisted according to the remember-password setting. `src/services/storage/secureStorage.ts` provides reversible obfuscation, not encryption or a security boundary. Do not weaken authentication, plugin trust checks, or session isolation for convenience.

## Commits & Guidance Maintenance

Use Conventional Commits, such as `feat(providers): add a provider` or `fix(auth-files): preserve disabled actions`. Keep changes focused. Pull requests should include a summary, linked issue when applicable, backend version/reproduction details for integration work, UI screenshots or notes when relevant, and verification results.

Maintain shared repository guidance in `AGENTS.md`. When updating it, synchronize the local `CLAUDE.md` to identical content if present; `CLAUDE.md` is currently ignored and untracked, so shared guidance must not depend on it. Keep guidance aligned with source and configuration rather than duplicating long implementation details.

## Monitoring & Usage Analytics Migration Notes

- Migration omission checklist: before handoff, explicitly audit restored Plus surfaces for usage statistics, request monitoring, OpenCode Go provider support, `seq-random` routing visibility, quota/provider metadata, Account Actions, dashboard stat navigation, and cross-page drilldowns. These are protected surfaces, not optional visual details.
- Do not simplify the restored Usage Analytics surfaces. Preserve the full Client Key Analysis, trend, detail, request drilldown, credential, heatmap, filters, and warning panels when merging upstream or CPA-Manager-Plus changes.
- Usage Analytics tabs are backed by `/v0/management/usage/monitoring/analytics` include fields. Treat `model_stats`, `model_share`, `channel_share`, `credential_stats`, `credential_timeline`, `heatmap`, `anomaly_points`, `events_page`, and `drilldown_preview` as protected fields; if summary cards show non-zero usage but any tab is empty, inspect the backend response contract before changing presentation code.
- Client key identity must match the backend contract everywhere: use `api_key_hash` with fallback to `source_hash` and then `source`. Apply the same identity in selector values, URL params, selected row lookup, trend requests, detail panels, related execution contexts, and Monitoring row filtering.
- OpenCode Go and Antigravity records often have an empty event `api_key_hash` while the aggregated client key is represented by `source_hash`. Do not drop these rows in client-side filters after the backend has already filtered by the selected client key.
- `Usage Analytics -> Client Key Analysis` must not show an empty Client Key Trend or empty Related Execution Contexts when the ranking table has requests for the selected key. If `api_key_stats.contexts` is absent, synthesize a context from `sources`, `source_hashes`, `auth_indices`, account, provider, calls, tokens, latency, and last-seen fields.
- Cross-page interaction is part of the contract, not optional polish. `Usage Analytics -> View request details` must route to Monitoring with equivalent filters (`api_key_hash`, model, provider, status, search, time range, and granularity-derived bounds when available). Monitoring must interpret the incoming params with the same client-key identity fallback and show matching summary cards, event rows, and selector labels.
- Monitoring-to-Usage navigation must preserve user intent as well: when a Monitoring row, account, key, or failure is opened in Usage Analytics, keep the selected entity, status, and time window aligned with the source Monitoring view. Do not replace entity filters with display labels or masked labels; route with stable ids/hashes and only use labels for presentation.
- URL-driven Monitoring drilldowns are transient. `api_key_hash` and `header_trace_id` from request-detail links may scope the current Monitoring view, but they must not persist as default `monitoring.centerUiState`; ordinary sidebar/default Monitoring visits must reopen with all client keys unless the URL explicitly scopes them.
- Account Actions depends on `usage/capabilities.account_actions.supported`. With the integrated local sqlite backend it should show the supported queue/list state, not the disabled `unsupported_local_sqlite` banner. Empty local candidate queues are valid, but unsupported is a regression.
- Dashboard headline traffic, success rate, chart legend, and provider activity must be derived from the same `/usage/dashboard/summary` usage contract as Monitoring/Usage Analytics. Do not fall back to legacy `recentRequests` data when a valid usage summary exists, or Dashboard can show `0%` while Monitoring shows successful calls.
- Dashboard stat tiles are semantic shortcuts, not all provider configuration links. `Provider keys` should open AI Providers, while `Models` must open the available model catalog (`/system#available-models`) because its count comes from the `/v1/models` model store, not from provider-key configuration.
- OpenCode Go provider UI is a protected migration surface. Preserve its provider card, quota details, model list, enabled state, and provider-specific validation entry points; do not collapse it into generic AI Providers behavior.
- OpenCode Go provider reachability and image/vision-proxy handling are separate validation surfaces. Include both in deployed `5317/8317` checks without treating one failure as covering the other.
- The two pages must be compared as a pair after migrations. For a selected top client key such as `sk-****2993`, Usage Analytics ranking counts, selected trend/details, Monitoring summary cards, Monitoring realtime/table rows, and the request-detail drilldown must all refer to the same underlying events. A pass on only one page is insufficient.
- Browser validation for these regressions should cover the deployed `5317/8317` flow: select a top client key such as `sk-****2993` in Last 30 days / Daily and confirm ranking, trend, related execution contexts, and View request details all show data. Also verify Monitoring client-key dropdown selection updates both summary cards and table rows.
