# B1 — Workflows: List & Execute

**Status:** ✅ Complete  
**Stories:** B1-1 through B1-5  
**Created:** April 30, 2026

## Overview

Workflow management for Dynatrace automation workflows. Users can browse, view details, and execute workflows from Raycast without leaving the terminal.

## Implemented Stories

### ✅ B1-1: Workflows List Command

**File:** `src/commands/workflows/index.tsx`

Features:
- Command `dt-workflows` registered in `package.json`
- List view with search by workflow name
- Grouping: Enabled / Disabled workflows
- Per-workflow display:
  - Name and description
  - Trigger type icon (🕐 schedule, ⚡ event, 👆 manual)
  - Owner team
  - Last execution status (with color coding)
  - Time since last execution

### ✅ B1-2: Workflow Detail View

**File:** `src/commands/workflows/workflow-detail.tsx`

Features:
- Configuration section: ID, owner, status, trigger type, created/modified timestamps
- Trigger configuration details
- Input parameters schema (if applicable)
- Recent execution history (last 5)
  - Status emoji (✅/❌/⏳/⏸/⊘)
  - Timestamp
  - Duration
  - Trigger source

### ✅ B1-3: Execute Without Parameters

**Implementation:** `workflow-detail.tsx` + `execute-workflow.tsx`

Features:
- "Execute Workflow" action
- Direct execution for workflows without input parameters
- Confirmation dialog with workflow name
- POST to `/platform/automation/v1/workflows/{id}/run`
- HUD shows execution ID
- Auto-polling of execution status (3s intervals)

### ✅ B1-4: Execute With Parameters

**File:** `src/commands/workflows/execute-workflow.tsx`

Features:
- Dynamic form generation from JSON Schema
- Support for field types:
  - Text input
  - Number input
  - Checkbox (boolean)
  - Dropdown (enum)
- Required field validation
- Submit with `{ input: { ...formValues } }` payload
- Error handling with user-friendly messages

### ✅ B1-5: Mock Mode Data

**File:** `src/lib/api/mock.ts`

Mock data includes:
- **7 workflows** with realistic metadata:
  - Mix of trigger types (SCHEDULE, EVENT, MANUAL)
  - Both enabled and disabled workflows
  - Varied owners (platform-team, devops-team, infrastructure-team, etc.)
  - Some with input parameters, some without
- **5 mock execution records** per workflow
  - Various statuses (SUCCEEDED, FAILED, RUNNING)
  - Timestamps and durations
  - Realistic trigger sources
- **4 mock execution tasks** for detailed breakdowns
  - Status tracking
  - Error messages
  - Duration metrics

## File Structure

```
src/
├── lib/
│   ├── types/
│   │   └── workflow.ts          ← Type definitions + Zod schemas
│   └── api/
│       └── mock.ts               ← Mock workflows & executions
├── commands/
│   └── workflows/
│       ├── index.tsx             ← Main list view
│       ├── workflow-detail.tsx   ← Detail view + history
│       └── execute-workflow.tsx  ← Execution form
├── dt-workflows.tsx              ← Re-export for package.json
└── __tests__/
    └── workflow.test.ts          ← 17 unit tests (all passing)

package.json
  └── "dt-workflows" command registered

src/commands/dt/index.tsx
  └── Workflows added to dt hub (icon: Gear, color: Orange)
```

## Type Definitions

**Workflow** (`src/lib/types/workflow.ts`):
```typescript
{
  id: string;
  name: string;
  description?: string;
  owner?: string;
  triggerType: "SCHEDULE" | "EVENT" | "MANUAL";
  enabled: boolean;
  lastExecutionStatus?: "RUNNING" | "SUCCEEDED" | "FAILED" | "PAUSED" | "SKIPPED";
  lastExecutionTime?: string (ISO-8601);
  inputParametersSchema?: JSON Schema;
  tags?: string[];
}
```

**WorkflowExecution**:
```typescript
{
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startTime: string (ISO-8601);
  endTime?: string;
  durationMs?: number;
  triggeredBy?: string;
}
```

**ExecutionTask**:
```typescript
{
  id: string;
  name: string;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  errorMessage?: string;
}
```

## API Integration

### REST Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/platform/automation/v1/workflows` | GET | List all workflows |
| `/platform/automation/v1/workflows/{id}` | GET | Get workflow details |
| `/platform/automation/v1/workflows/{id}/executions` | GET | Execution history |
| `/platform/automation/v1/workflows/{id}/executions/{execId}` | GET | Execution details |
| `/platform/automation/v1/workflows/{id}/executions/{execId}/tasks` | GET | Task breakdown |
| `/platform/automation/v1/workflows/{id}/run` | POST | Execute workflow |
| `/platform/automation/v1/workflows/{id}/executions/{execId}/cancel` | PATCH | Cancel execution (B2) |

## Testing

**Unit Tests:** `src/__tests__/workflow.test.ts`

Coverage:
- ✅ Type validation (17 tests, all passing)
- ✅ Schema validation
- ✅ Mock data completeness
- ✅ Filter logic (by trigger type, owner)
- ✅ Execution history tracking
- ✅ Parameter validation
- ✅ Status formatting
- ✅ Duration calculation

Run tests:
```bash
npm test -- workflow.test.ts
```

## UI/UX Details

### List View
- Searchable by workflow name
- Status indicator (🟢 enabled / ⚫ disabled)
- Trigger type icon indicates automation source
- Last execution time shows relative duration (5m ago, 2h ago, etc.)

### Detail View
- Markdown formatted for easy reading
- Configuration summary table
- Recent executions with status indicators
- Action to execute directly (with/without params)
- Deep link to Dynatrace UI

### Execute Form
- Auto-generated from JSON schema
- Type-aware input fields
- Required field validation
- Clear error messages
- Progress indicator during execution

## Next Steps (B2 & Beyond)

**B2 — Workflow Executions — History & Logs:**
- Task breakdown for failed executions
- Cancel and re-run actions
- Pagination support

**B3 — Settings / Config Management:**
- Search and browse configuration objects
- JSON view with copy/export

**B4 — Maintenance Windows:**
- List active and scheduled windows
- Create, edit, delete maintenance windows

## Notes

1. **Mock mode**: All workflows use mock data when `useMockData` preference enabled
2. **Deep links**: Integration with `buildDeepLink()` util for Dynatrace navigation
3. **Error handling**: User-friendly messages for 403 (no license), 429 (rate limit), network errors
4. **Auto-refresh**: Details view can be refreshed via Cmd+R action
5. **Polling**: Execution status polling happens every 3 seconds while RUNNING

## Known Limitations / Future Enhancements

- [ ] Real-time execution status polling (mock returns static data)
- [ ] Execution task detail view (drill down into failed tasks)
- [ ] Workflow execution logs/output capture
- [ ] Parameter history (remember previous values)
- [ ] Workflow templates/favorites
- [ ] Execution comparison (before/after metrics)
