# B2 — Workflow Executions: History & Logs

**Status:** ✅ Complete  
**Stories:** B2-1, B2-2  
**Created:** April 30, 2026

## Overview

Deep execution management for Dynatrace workflows. Users can view execution history, analyze task breakdowns, and manage running executions (cancel/re-run) from Raycast.

## Implemented Stories

### ✅ B2-1: Task Breakdown Detail View

**File:** `src/commands/workflows/execution-detail.tsx`

Features:
- Full execution details with markdown formatting
- Status banner with emoji (✅/❌/⏳/⏸/⊘)
- Timeline: start time, end time, duration, triggered by
- **Task breakdown table** with per-task information:
  - Task number, name, status icon
  - Duration (in seconds/milliseconds)
  - Error messages (if failed)
- **Error details section** - expanded view of failed task error messages
- Execution output (if available) in JSON format
- Scrollable error messages for detailed debugging

**Mock Data:**
- 4 execution tasks with realistic statuses
- Failed tasks include error messages (e.g., "Slack webhook failed: 403 Forbidden")
- Completed tasks show duration metrics
- RUNNING tasks show progress indicator

### ✅ B2-2: Cancel & Re-run Execution

**File:** `src/commands/workflows/execution-detail.tsx`

Features:

**Cancel Action:**
- Only available for RUNNING executions
- PATCH `/platform/automation/v1/executions/{id}/cancel`
- Request body: `{ state: "CANCELLED" }`
- HUD feedback: "Execution Cancelled"
- Confirmation check: prevents cancelling completed executions
- Auto-refresh after successful cancel

**Re-run Action:**
- Available for SUCCEEDED/FAILED executions
- POST `/platform/automation/v1/workflows/{workflowId}/run`
- Preserves original input parameters
- Creates new execution with same config
- HUD feedback: "Workflow Re-started"
- Navigates back to list after re-run
- Validation: blocks re-run of RUNNING executions

### Execution History List

**File:** `src/commands/workflows/executions-list.tsx`

Features:
- Paginated list of workflow executions (10 per page)
- Sort by startTime descending (most recent first)
- Per-execution display:
  - Status with color coding (green/red/yellow)
  - Duration (formatted as "1m 30s")
  - Time since execution (5m ago, 2h ago, etc.)
  - Trigger source (incident-142, schedule, manual, etc.)
- Navigation: Next/Previous page actions
- Click to view detailed breakdown
- Page indicator: "Page X of Y (N total)"

## File Structure

```
src/
├── commands/
│   └── workflows/
│       ├── index.tsx                     ← B1: Main list
│       ├── workflow-detail.tsx           ← B1: Detail + B2: Execution history action
│       ├── execute-workflow.tsx          ← B1: Execution form
│       ├── execution-detail.tsx          ← B2: Task breakdown + cancel/re-run
│       └── executions-list.tsx           ← B2: Execution history with pagination
│
└── __tests__/
    ├── workflow.test.ts                  ← B1: 17 tests
    └── workflow-execution.test.ts        ← B2: 22 tests (all passing)
```

## Type Extensions

**WorkflowExecution** (updated from B1):
- `id`: Unique execution identifier
- `workflowId`: Parent workflow ID
- `status`: RUNNING | SUCCEEDED | FAILED | PAUSED | SKIPPED
- `startTime`: ISO-8601 timestamp
- `endTime`: Optional ISO-8601 timestamp
- `durationMs`: Milliseconds (for completed executions)
- `triggeredBy`: String (incident-142, schedule, manual, etc.)
- `result.output`: Execution output object (optional)

**ExecutionTask** (new in B2):
```typescript
{
  id: string;
  name: string;
  status: ExecutionStatus;
  startTime: string (ISO-8601);
  endTime?: string;
  durationMs?: number;
  errorMessage?: string;
  inputs?: unknown;
  outputs?: unknown;
}
```

## API Integration

### REST Endpoints Used

| Endpoint | Method | Purpose | Story |
|----------|--------|---------|-------|
| `/platform/automation/v1/workflows/{id}/executions` | GET | Get execution history | B2-1 |
| `/platform/automation/v1/executions/{id}` | GET | Get execution details | B2-1 |
| `/platform/automation/v1/executions/{id}/tasks` | GET | Get task breakdown | B2-1 |
| `/platform/automation/v1/executions/{id}/cancel` | PATCH | Cancel execution | B2-2 |
| `/platform/automation/v1/workflows/{id}/run` | POST | Re-run workflow | B2-2 |

### Request/Response Structures

**Cancel Request:**
```json
{
  "state": "CANCELLED"
}
```

**Re-run Request:**
```json
{
  "input": { /* original execution inputs */ }
}
```

## Navigation Flow

```
Workflows List (B1-1)
  ↓
Workflow Detail (B1-2)
  ├─ Action: "View Execution History" → Executions List (B2-1)
  │   ↓
  │   Execution Detail (B2-1)
  │     ├─ Action: "Cancel Execution" (RUNNING only)
  │     └─ Action: "Re-run Workflow" (SUCCEEDED/FAILED)
  │
  └─ Action: "Execute Workflow" → Execute Form (B1-4)
```

## Testing

**Unit Tests:** `src/__tests__/workflow-execution.test.ts`

Coverage (22 tests):
- ✅ Task breakdown completeness
- ✅ Error message handling
- ✅ Task duration calculation
- ✅ Task ordering by timestamp
- ✅ Execution grouping
- ✅ Cancel restrictions (RUNNING only)
- ✅ Re-run eligibility (SUCCEEDED/FAILED)
- ✅ Input preservation for re-run
- ✅ Status transitions
- ✅ Pagination logic
- ✅ API request construction
- ✅ Error handling

Run tests:
```bash
npm test -- workflow-execution.test.ts
```

## UI/UX Details

### Execution Detail View
- **Markdown formatting** for consistent styling
- **Status banner** with emoji for quick visual identification
- **Timeline section** with all timestamps and duration
- **Task table** with inline status indicators
- **Error details** collapsed by default, expanded for failed tasks
- **JSON output** in code blocks for raw data inspection

### Executions List
- **Paginated results** (10 per page, configurable)
- **Status color coding**:
  - 🟢 Green: SUCCEEDED
  - 🔴 Red: FAILED
  - 🟡 Yellow: RUNNING
  - ⚫ Gray: PAUSED/SKIPPED
- **Relative timestamps** (5m ago, 2h ago, etc.)
- **Duration formatting** (5s, 1m 30s, etc.)
- **Quick navigation** with Previous/Next page actions

### Error Handling
- Validation: prevents cancel of non-running executions
- Validation: prevents re-run of running executions
- User-friendly HUD messages
- Auto-refresh after state changes
- Graceful fallback when task data unavailable

## Integration with B1

- **Extends workflow-detail.tsx** with "View Execution History" action
- **Reuses execution data** from mock.ts
- **Compatible with execute-workflow.tsx** - re-run preserves input schema
- **Maintains navigation stack** for back/pop behavior

## Known Limitations / Future Enhancements

- [ ] Real-time execution status updates (WebSocket polling)
- [ ] Execution logs/output streaming
- [ ] Bulk operations (cancel multiple executions)
- [ ] Execution filters (by status, time range)
- [ ] Execution comparison (side-by-side diff)
- [ ] Task dependency visualization
- [ ] Retry with modified inputs
- [ ] Execution metrics dashboard

## Dependencies

- B1 (Workflows List & Detail) - provides parent context
- Existing auth/REST infrastructure
- useDynatraceRest hook (via SI-1)
- Mock data in src/lib/api/mock.ts

## Notes

1. **Pagination**: Uses `nextPageKey` pattern (ready for API integration)
2. **Status polling**: 3-second intervals for RUNNING executions (B1 behavior)
3. **Error context**: Full error messages preserved for debugging
4. **Input traceability**: Execution input preserved for re-run operations
5. **Task ordering**: Tasks sorted by startTime for visual clarity
