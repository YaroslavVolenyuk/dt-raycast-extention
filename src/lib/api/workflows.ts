// src/lib/api/workflows.ts
// AutomationEngine API client for workflow executions.
//
// Documented endpoint (no probing — see .claude/instructions/dynatraceapi.md):
//   GET /platform/automation/v1/executions?workflow=<workflowId>&limit=<n>
//   → { count, results: [{ id, workflow, state, startedAt, endedAt, ... }] }

import { z } from "zod";
import { dynatraceRest, registerMock } from "./rest";
import type { TenantConfig } from "../auth";
import type { WorkflowExecution } from "../types/workflow";
import { MOCK_WORKFLOW_EXECUTIONS } from "./mock";

export const EXECUTIONS_PATH = "/platform/automation/v1/executions";

// ── Raw API schema (permissive — unknown fields pass through) ────────────────

const automationExecutionSchema = z
  .object({
    id: z.string(),
    workflow: z.string().optional(),
    state: z.string(),
    title: z.string().optional(),
    startedAt: z.string().nullable().optional(),
    endedAt: z.string().nullable().optional(),
    triggerType: z.string().nullable().optional(),
    user: z.string().nullable().optional(),
  })
  .passthrough();

export type AutomationExecution = z.infer<typeof automationExecutionSchema>;

export const executionsResponseSchema = z.object({
  count: z.number().optional(),
  results: z.array(automationExecutionSchema),
});

// ── Mapper ───────────────────────────────────────────────────────────────────

function stateToStatus(state: string): string {
  switch (state) {
    case "SUCCESS":
      return "SUCCEEDED";
    case "ERROR":
      return "FAILED";
    default:
      return state; // RUNNING, PAUSED, CANCELLED, ... — show the API value as-is
  }
}

export function automationExecutionToDisplay(e: AutomationExecution, workflowId: string): WorkflowExecution {
  const startMs = e.startedAt ? new Date(e.startedAt).getTime() : NaN;
  const endMs = e.endedAt ? new Date(e.endedAt).getTime() : NaN;
  const durationMs = !Number.isNaN(startMs) && !Number.isNaN(endMs) ? endMs - startMs : undefined;

  return {
    id: e.id,
    workflowId: e.workflow ?? workflowId,
    status: stateToStatus(e.state),
    startTime: e.startedAt ?? "",
    endTime: e.endedAt ?? null,
    durationMs,
    triggeredBy: e.user ?? e.triggerType ?? undefined,
  };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchWorkflowExecutions(
  tenant: TenantConfig,
  workflowId: string,
  limit = 50,
): Promise<WorkflowExecution[]> {
  const response = await dynatraceRest(tenant, EXECUTIONS_PATH, {
    schema: executionsResponseSchema,
    queryParams: { workflow: workflowId, limit: String(limit) },
  });

  return response.data.results
    .map((e) => automationExecutionToDisplay(e, workflowId))
    .filter((e) => e.workflowId === workflowId);
}

// ── Mock (module-level registration — V13) ──────────────────────────────────

registerMock(EXECUTIONS_PATH, {
  count: MOCK_WORKFLOW_EXECUTIONS.length,
  results: MOCK_WORKFLOW_EXECUTIONS.map((e) => ({
    id: e.id,
    workflow: e.workflowId,
    state: e.status === "SUCCEEDED" ? "SUCCESS" : e.status === "FAILED" ? "ERROR" : e.status,
    startedAt: e.startTime,
    endedAt: e.endTime ?? null,
    user: e.triggeredBy,
  })),
});
