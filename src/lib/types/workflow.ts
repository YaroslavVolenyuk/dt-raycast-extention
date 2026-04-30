// src/lib/types/workflow.ts
import { z } from "zod";

// Execution status
export const executionStatusSchema = z.enum(["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"]);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

// Trigger types
export const triggerTypeSchema = z.enum(["SCHEDULE", "EVENT", "MANUAL"]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

// Workflow execution
export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: executionStatusSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  triggeredBy: z.string().optional(), // user or trigger type
  result: z.object({
    output: z.unknown().optional(),
  }).optional(),
});

export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

// Workflow type
export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner: z.string().optional(),
  triggerType: triggerTypeSchema, // SCHEDULE, EVENT, MANUAL
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
  lastExecutionStatus: executionStatusSchema.nullable().optional(),
  lastExecutionTime: z.string().datetime().nullable().optional(),
  inputParametersSchema: z.object({}).passthrough().optional(), // JSON Schema
  tags: z.array(z.string()).optional(),
});

export const workflowListSchema = z.array(workflowSchema);

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
