# Dynatrace Workflow Executions API Endpoint Debugging

## Current Issue
The extension is getting **404 Not Found** when trying to fetch workflow executions from Dynatrace using the endpoint:
```
/platform/automation/v1/workflows/{workflowId}/executions
```

## What I Did
I updated both `workflow-detail.tsx` and `executions-list.tsx` to **automatically try 12 different endpoint paths**:

1. `/platform/automation/v1/workflows/{id}/executions`
2. `/api/v2/workflows/{id}/executions`
3. `/api/v2/automation/workflows/{id}/executions`
4. `/api/v2/automations/{id}/executions`
5. `/api/v2/automations/workflows/{id}/executions`
6. `/platform/automation/v1/workflows/{id}/runs`
7. `/api/v2/workflows/{id}/runs`
8. `/api/v2/workflows/{id}/history`
9. `/api/v2/workflows/{id}/tasks`
10. `/platform/automation/v1/workflows/{id}` (returns workflow details, may include recent executions)
11. `/api/v2/workflows/{id}`
12. `/api/v2/automations/{id}`

The code will also try to extract execution data from various response structures:
- Direct array response: `[{...}, {...}]`
- Nested in `results`: `{ results: [{...}] }`
- Nested in `executions`: `{ executions: [{...}] }`
- Nested in `runs`: `{ runs: [{...}] }`
- Nested in `tasks`: `{ tasks: [{...}] }`
- Nested in `history`: `{ history: [{...}] }`

## How to Test

### Option 1: Check Raycast Extension Logs
1. Open the Raycast extension in development mode
2. Navigate to a workflow to trigger the API calls
3. Open the browser console or Raycast logs
4. Look for messages like:
   - `[workflow-detail] ✅ Attempt 2 SUCCESS` → Endpoint 2 worked
   - `[workflow-detail] ❌ ALL ENDPOINTS FAILED` → Need more investigation

### Option 2: Use Curl to Test Directly
First, get an access token from Dynatrace, then test endpoints:

```bash
# Replace these with your actual values
TENANT_URL="https://your-tenant.live.dynatrace.com"
WORKFLOW_ID="55247bef-1a0d-4fda-ba07-b9557ea52858"
ACCESS_TOKEN="your-oauth-token"

# Quick test - try one endpoint to verify auth works
curl -X GET \
  "$TENANT_URL/api/v2/workflows/$WORKFLOW_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# If that works, try execution endpoints in order:
# 1. /api/v2/workflows/{id}/executions
curl -X GET \
  "$TENANT_URL/api/v2/workflows/$WORKFLOW_ID/executions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# 2. /api/v2/workflows/{id}/runs
curl -X GET \
  "$TENANT_URL/api/v2/workflows/$WORKFLOW_ID/runs" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# 3. /api/v2/automations/{id}
curl -X GET \
  "$TENANT_URL/api/v2/automations/$WORKFLOW_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"
```

Or use the automated test script:
```bash
node test-api-endpoints.js "$TENANT_URL" "$WORKFLOW_ID" "$ACCESS_TOKEN"
```

### Option 3: Check Dynatrace API Docs
Visit: https://docs.dynatrace.com/docs/dynatrace-api
Look for:
- Automation / Workflows section
- Look for execution/run history endpoints
- Compare response structure with what we expect

## Expected Response Structure
Once we find the working endpoint, the response should contain execution data like:
```json
{
  "results": [
    {
      "id": "execution-123",
      "status": "SUCCEEDED",
      "startTime": "2024-01-15T10:30:00Z",
      "durationMs": 5000,
      "triggeredBy": "schedule",
      "workflowId": "workflow-123"
    }
  ]
}
```

OR just an array:
```json
[
  {
    "id": "execution-123",
    "status": "SUCCEEDED",
    ...
  }
]
```

## Next Steps
1. Test one of the endpoints above (curl is easiest)
2. Find which endpoint returns 200 OK (not 404)
3. Note the response structure
4. Once you find the working endpoint:
   - Tell me the correct path
   - Show me the response structure
   - I'll update the code to use it permanently

## Debug Logs to Look For
In Raycast or browser console, you'll see:
```
[workflow-detail] Attempt 1/12: Trying /platform/automation/v1/workflows/55247bef-1a0d-4fda-ba07-b9557ea52858/executions
[workflow-detail] ❌ Attempt 1 failed: { statusCode: 404, ... }
[workflow-detail] Attempt 2/12: Trying /api/v2/workflows/55247bef-1a0d-4fda-ba07-b9557ea52858/executions
[workflow-detail] ✅ Attempt 2 SUCCESS (status 200)
[workflow-detail] Working endpoint: /api/v2/workflows/55247bef-1a0d-4fda-ba07-b9557ea52858/executions
[workflow-detail] Response keys: ["results"]
[workflow-detail] Got 42 executions from API
```

Once you see "✅ SUCCESS", we know the correct endpoint!

## If All 12 Endpoints Fail

If you see:
```
[workflow-detail] ❌ ALL 12 ENDPOINTS FAILED
```

This suggests:
1. **Workflow executions might not be exposed via REST API** - check if Dynatrace has UI-only access to this data
2. **Different API structure in your environment** - Labs sandbox might differ from standard
3. **Missing permissions/scopes** - OAuth token might not have automation/workflow access
4. **Workflows data might be in a different location** - try:
   - `/api/v2/automations` (list all)
   - `/api/v2/automations` with query params
   - Check if workflows are under a different namespace

## Investigating Further

1. **Check available APIs**:
   ```bash
   curl -X GET \
     "$TENANT_URL/api/v2" \
     -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
   ```

2. **Look for "automation" or "workflow" related endpoints** in the response

3. **Check if workflows endpoint returns execution data**:
   ```bash
   curl -X GET \
     "$TENANT_URL/api/v2/workflows/$WORKFLOW_ID" \
     -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
   ```
   Look for fields like `executions`, `runs`, `history`, `lastExecution`, etc.

4. **Check OAuth token scopes** - ensure it has permissions for:
   - `automation:workflows:read`
   - `automation:executions:read`
   - Any other automation-related scopes
