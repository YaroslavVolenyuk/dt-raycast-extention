# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- 🗂 **Epic 2.0 commands**: Dynatrace hub (`dt`), NL2DQL, Ask Davis, SLO Dashboard, SLOs in Menu Bar, Workflows (list/execute/execution history), Settings browser, Synthetic Monitors, System Status dashboard, Maintenance Windows (list/create/delete), Search Traces, Test Connection
- 🧰 Generic REST client (`dynatraceRest`) with Zod validation, classic-proxy rewrite, pagination, mock registry, client-side timeout
- 🔐 gitleaks secret scanning in CI

### Changed
- **Problems contract fixed against live Grail**: classification now uses `event.category` (AVAILABILITY / ERROR / SLOWDOWN / RESOURCE_CONTENTION / CUSTOM_ALERT); `event.severity` is a numeric string and is displayed as-is; problem sorting by `event.start`
- **SLO contract fixed against the documented v2 API**: `evaluatedPercentage` (not `compliance`), `evaluate=true` with pageSize 25 pagination, state taken from the API `status` field (FAILURE < target ≤ WARNING < warning ≤ SUCCESS)
- **Maintenance Windows now use the real Settings 2.0 contract** (`builtin:alerting.maintenance-window`): correct read mapping, array payload with `schemaId`/`scope` on create (validated with `validateOnly=true` first), real delete
- **Workflow execution history** uses the single documented endpoint `GET /platform/automation/v1/executions?workflow=<id>` (removed 12-endpoint probing)
- **Settings browser** requests the mandatory `schemaIds` parameter and explicit `fields`
- Default OAuth scopes are now read-only; write scopes (`settings:objects:write`, `automation:workflows:*`) are opt-in
- Davis CoPilot scopes included in the suggested scope list
- REST pagination uses the correct `nextPageKey` parameter name
- 401-retry now runs before Davis CoPilot 403 mapping (stale tokens no longer masquerade as missing subscription)
- Menu bar commands (problems, SLOs) show an explicit "Dynatrace unreachable" state instead of a false-healthy checkmark
- System Status renders per-section "Unavailable" with the error reason; deployments stub removed; navigation uses `launchCommand`
- Synthetic Monitors no longer fabricate availability/response-time values; absent metrics render as absent
- Ask Davis no longer pretends to keep conversation history or entity context (the API call never sent them); source links are validated as https before opening
- macOS-only (`platforms`) since the extension ships menu-bar commands

### Removed
- Metrics Explorer command (was mock-only in real mode) — will return when backed by a real timeseries query

## [1.0.0] — 2026-04-20

### Added
- 🔐 OAuth 2.0 client credentials authentication (replaces static Bearer token)
- 👥 Multi-tenant support with Manage Tenants command for adding/editing/switching environments
- 🔍 Search Logs command with server-side DQL filtering by service, content, and timestamp
- 📊 Log detail view with JSON pretty-print and stack trace formatting
- 🔗 Related logs navigation — search by trace_id, service ±5 min, or all errors in service
- 🚨 Active Problems command displaying Davis AI problems with severity color-coding
- 🎯 Problems-to-logs correlation actions with automatic service and time filters
- 🚀 Recent Deployments command with incident correlation capabilities
- 🏷 Find Entity command for searching services, hosts, and process groups
- ⚡ Run DQL Query command for executing arbitrary Grail queries with dynamic result tables
- 💾 Saved DQL Queries library — CRUD management of frequently used queries
- 🖥 Menu Bar Problems counter with 5-minute auto-refresh (ambient monitoring)
- 🔄 Pagination support in Search Logs with "Load more" action
- ⏱ Timeframe presets (15m, 1h, 4h, 24h, 7d) with LocalStorage persistence
- 📋 Export functionality — copy as JSON/CSV or save to file in extension support path
- 🧪 Comprehensive unit tests for utilities (buildDqlQuery, parseTimeframe, formatLogContent)
- ✅ GitHub Actions CI pipeline (lint + build + test on every PR)

### Changed
- Refactored codebase from single-command to multi-command architecture
- Replaced client-side service filtering with server-side DQL filters
- Upgraded to Zod v4 for runtime schema validation
- Improved error messages for OAuth failures and network timeouts

### Fixed
- Race condition on rapid filter changes — added AbortController for request cancellation
- Memory leak from unaborted fetch requests — now properly cleaned up on component unmount
- Stale data display — integrated useCachedPromise for instant previous-data rendering

### Security
- OAuth credentials stored exclusively in non-CloudSync LocalStorage (not synced to iCloud)
- Access tokens cached with 30-second refresh margin to prevent expiration races
- Client secrets never logged or displayed in error messages or toast notifications
- Sensitive error body content redacted in OAuthError (client_secret replaced with [REDACTED])

### Internal
- Established comprehensive logging patterns for development/debug modes
- Added JSDoc comments to all public API functions
- Set up TypeScript strict mode across entire codebase
