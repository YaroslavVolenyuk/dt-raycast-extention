import { z } from "zod";

/**
 * Dynatrace Synthetic Monitor types
 */

export enum MonitorType {
  HTTP = "HTTP",
  BROWSER = "BROWSER",
  THIRD_PARTY = "THIRD_PARTY",
}

export enum ExecutionStatus {
  OK = "OK",
  FAILED = "FAILED",
  PARTIAL_FAILED = "PARTIAL_FAILED",
  TIMEOUT = "TIMEOUT",
}

export const LocationResultSchema = z.object({
  location: z.string().describe("Location name"),
  status: z.nativeEnum(ExecutionStatus),
  responseTime: z.number().optional().describe("Response time in ms"),
  errorMessage: z.string().optional(),
  timestamp: z.number(),
});

export type LocationResult = z.infer<typeof LocationResultSchema>;

export const MonitorExecutionSchema = z.object({
  executionId: z.string(),
  monitorId: z.string(),
  timestamp: z.number(),
  status: z.nativeEnum(ExecutionStatus),
  responseTime: z.number().optional(),
  locationResults: z.array(LocationResultSchema),
  errorMessage: z.string().optional(),
});

export type MonitorExecution = z.infer<typeof MonitorExecutionSchema>;

export const SyntheticMonitorSchema = z.object({
  monitorId: z.string(),
  name: z.string(),
  type: z.nativeEnum(MonitorType),
  url: z.string().url().describe("Monitor URL/endpoint"),
  enabled: z.boolean().default(true),
  schedule: z.object({
    interval: z.number().describe("Interval in minutes"),
    timezone: z.string().optional(),
  }),
  locations: z.array(z.string()).describe("List of execution locations"),
  owner: z.string().optional(),
  createdAt: z.number(),
  modifiedAt: z.number(),
  tags: z.record(z.string()).optional(),
});

export type SyntheticMonitor = z.infer<typeof SyntheticMonitorSchema>;

/**
 * Monitor with aggregated status data
 */
export const SyntheticMonitorDataSchema = z.object({
  monitor: SyntheticMonitorSchema,
  availability: z.number().min(0).max(100).describe("Availability percentage"),
  failureCount: z.number().describe("Number of failed executions"),
  avgResponseTime: z.number().optional().describe("Average response time in ms"),
  lastExecution: MonitorExecutionSchema.optional(),
  recentExecutions: z.array(MonitorExecutionSchema).optional(),
});

export type SyntheticMonitorData = z.infer<typeof SyntheticMonitorDataSchema>;

/**
 * Calculate status color based on availability and status
 */
export function getMonitorStatus(monitor: SyntheticMonitorData): ExecutionStatus {
  if (!monitor.lastExecution) {
    return ExecutionStatus.OK;
  }
  return monitor.lastExecution.status;
}

/**
 * Calculate availability percentage
 */
export function calculateAvailability(executions: MonitorExecution[]): number {
  if (executions.length === 0) return 100;

  const successfulCount = executions.filter((e) => e.status === ExecutionStatus.OK).length;
  return Math.round((successfulCount / executions.length) * 100);
}
