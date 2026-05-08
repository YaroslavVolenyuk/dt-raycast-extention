# Security Rules

Use this before touching authentication, preferences, Jira integration, logging, telemetry, exports, or storage.

## Secrets — Never Log or Display

- OAuth access tokens, client secrets, or client IDs paired with secrets
- Jira API tokens, Basic auth headers, or base64 auth values
- `Authorization` header values, raw sensitive request bodies
- Full user log content when it might contain credentials

**Safe to log:**
- Token length only (e.g. `token.length` for diagnostics)
- Tenant `id` and `name` — never `clientSecret` or `clientId`
- Endpoint path without query params that may contain secrets
- Error class, HTTP status code, and a short sanitized message

`OAuthError` in `auth.ts` already auto-redacts `client_secret` from error bodies — preserve this behavior.

## Credential Storage

| Credential | Where stored | Why |
|---|---|---|
| Tenant `clientId` + `clientSecret` | Raycast `LocalStorage` (`tenants:v1`) | User-managed, local only |
| OAuth access tokens | Raycast `Cache` namespace `dt-oauth` | Short-lived, never persisted to disk |
| Jira URL, email, API token | Raycast `preferences` (declared in `package.json`) | Managed by Raycast, shown in UI as password field |

- Do not change storage keys without a migration path
- Do not export secrets in JSON/CSV clipboard actions
- Password-like user inputs must use Raycast `password` preference type

## API Calls

- All Dynatrace OAuth must go through `src/lib/auth.ts` — never call the SSO endpoint directly elsewhere
- Grail query execution must remain centralized in `src/lib/query.ts`
- Jira calls must go through `src/lib/integrations/jira.ts`
- Redact request bodies before logging — avoid logging raw DQL if it may include user data, unless explicitly in dev-only diagnostics guarded by `isMockMode()`

## DQL Injection Prevention

Always use `escapeDqlString()` from `src/lib/utils/buildDqlQuery.ts` before interpolating user input:

```typescript
// ✅ Safe
`filter service.name == "${escapeDqlString(userInput)}"`

// ❌ Unsafe — DQL injection possible
`filter service.name == "${userInput}"`
```

`extraFilter` in `buildDqlQuery()` is intentionally unescaped — it is a power-user feature that accepts raw DQL. Never pass untrusted user input to `extraFilter`.

## Error Handling

- User-facing errors must be actionable but must not reveal secrets or internal paths
- Preserve underlying HTTP status codes in typed errors (e.g. `OAuthError.statusCode`) for debugging
- Do not swallow errors in production commands unless the command is explicitly best-effort (e.g. `dt-alerts` background polling)
- On 401: invalidate the cached token with `invalidateTokenCache(tenant.id)` and retry once

## Telemetry

- Telemetry is opt-in — do not add remote logging or analytics without explicit approval
- Do not add OpenTelemetry or remote logging dependencies without approval
- Telemetry attributes must not include query content, tokens, email addresses, or raw log data
- `DT_MCP_DISABLE_TELEMETRY` env var disables Dynatrace MCP telemetry if MCP is used in development
