// src/lib/types/workflow.ts
import { z } from "zod";

// Execution status
export const executionStatusSchema = z.enum(["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"]);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

// Trigger types
export const triggerTypeSchema = z.enum(["SCHEDULE", "EVENT", "MANUAL"]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

// Workflow execution (display model — mapped from the Automation API in lib/api/workflows.ts)
export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  // Known states are mapped (SUCCESS→SUCCEEDED, ERROR→FAILED); unknown API states pass through as-is.
  status: executionStatusSchema.or(z.string()),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  triggeredBy: z.string().optional(), // user or trigger type
  result: z
    .object({
      output: z.unknown().optional(),
    })
    .optional(),
});

export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

// API workflow format
const workflowApiSchema = z
  .object({
    id: z.string(),
    title: z.string(), // API uses 'title'
    description: z.string().nullable().optional(),
    owner: z.string().optional(),
    triggerType: z.string().optional(), // "Manual", "Schedule", etc.
    isDeployed: z.boolean().optional(),
    lastExecution: z.unknown().optional(),
  })
  .passthrough()
  .transform((data) => ({
    id: data.id,
    name: data.title, // map title -> name
    description: data.description,
    owner: data.owner,
    triggerType: (data.triggerType?.toUpperCase() as TriggerType) || "MANUAL",
    enabled: data.isDeployed ?? true,
    lastExecutionStatus: null,
    lastExecutionTime: null,
  }));

// Workflow step
export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // e.g., "action", "condition", "notification", etc.
  description: z.string().optional(),
  order: z.number().optional(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

// Mock workflow format
export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner: z.string().optional(),
  triggerType: triggerTypeSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
  lastExecutionStatus: executionStatusSchema.nullable().optional(),
  lastExecutionTime: z.string().datetime().nullable().optional(),
  inputParametersSchema: z.object({}).passthrough().optional(),
  tags: z.array(z.string()).optional(),
  steps: z.array(workflowStepSchema).optional(),
});

// API response wrapper: { count, results: [...] }
const workflowApiResponseSchema = z.object({
  count: z.number(),
  results: z.array(workflowApiSchema),
});

// List schema - handles both array (mock) and wrapper object (API)
export const workflowListSchema = z.union([
  z.array(workflowSchema),
  workflowApiResponseSchema.transform((r) => r.results),
]);

export type Workflow = z.infer<typeof workflowSchema>;

// Workflow execution detail (with task breakdown)
export const executionTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: executionStatusSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  inputs: z.unknown().optional(),
  outputs: z.unknown().optional(),
});

export type ExecutionTask = z.infer<typeof executionTaskSchema>;

export const executionDetailSchema = workflowExecutionSchema.extend({
  tasks: z.array(executionTaskSchema).optional(),
});

export type ExecutionDetail = z.infer<typeof executionDetailSchema>;
