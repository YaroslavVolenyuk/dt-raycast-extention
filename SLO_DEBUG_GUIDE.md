# SLO Dashboard — Debug Guide

## 403 Forbidden Error

If you're getting a 403 Forbidden error when trying to access SLO dashboards, it means your API token is missing required OAuth scopes.

## Quick Test

Run this to test your token:

```bash
node test-slo-endpoints.js "https://YOUR_TENANT.live.dynatrace.com" "YOUR_ACCESS_TOKEN"
```

Replace:
- `YOUR_TENANT` — Your Dynatrace tenant ID (e.g., `abc12345`)
- `YOUR_ACCESS_TOKEN` — Your Dynatrace access token (starts with `dt0c01.st...`)

## What This Does

Tests all SLO-related endpoints and shows which ones work and which ones fail.

Failures usually mean missing scopes.

## Required Scopes for SLO

Add these scopes to your access token:

| Feature | Required Scopes |
|---------|-----------------|
| Read SLOs | `slo:slos:read` |
| Create/Edit SLOs | `slo:slos:write` |
| Read SLO templates | `slo:objective-templates:read` |
| Environment API (read) | `environment-api:slo:read` |
| Environment API (write) | `environment-api:slo:write` |

## How to Update Your Token

1. Go to your Dynatrace environment
2. Navigate to **Access Tokens** (usually in Settings/Security)
3. Create a new token or edit existing one
4. Add required scopes:
   - `slo:slos:read`
   - `slo:slos:write`
   - `environment-api:slo:read`
   - `environment-api:slo:write`
5. Save and test with `test-slo-endpoints.js` again

## Logs & Console Output

When running the extension, check browser/app console for these debug logs:

```
[SLO] Fetching /api/v2/slo
[SLO] API Error for /api/v2/slo: { error: "...", statusCode: 403, ... }
[REST] 403 Forbidden - likely missing OAuth scopes
```

## Still Having Issues?

1. **403 but token seems valid?**
   - Verify scopes in Dynatrace UI
   - Try regenerating the token
   - Ensure token hasn't expired

2. **401 Unauthorized?**
   - Token is invalid or expired
   - Regenerate a new token
   - Check token in settings

3. **Different endpoint, same error?**
   - Check `test-slo-endpoints.js` output
   - Each endpoint has different scope requirements

## Common Scope Reference

Full list needed for complete SLO support:

```
slo:objective-templates:read
slo:slos:read
slo:slos:write
environment-api:slo:read
environment-api:slo:write
storage:metrics:read
storage:metrics:write
storage:logs:read
storage:logs:write
```
