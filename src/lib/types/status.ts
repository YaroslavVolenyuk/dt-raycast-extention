import { z } from "zod";
import { problemSchema } from "./problem";
import { sloSchema } from "./slo";
import { SyntheticMonitorDataSchema } from "./synthetic";

/**
 * Dynatrace Status Dashboard types
 */

export enum ProblemSeverity {
  CRITICAL = "CRITICAL",
  MAJOR = "MAJOR",
  MINOR = "MINOR",
  WARNING = "WARNING",
}

export const StatusDashboardSchema = z.object({
  lastChecked: z.number().describe("Timestamp of last check"),
  problems: z
    .object({
      total: z.number(),
      bySeverity: z.record(z.nativeEnum(ProblemSeverity), z.number()),
      items: z.array(problemSchema).optional(),
    })
    .nullable(),
  slos: z
    .object({
      total: z.number(),
      violated: z.number(),
      items: z.array(sloSchema).optional(),
    })
    .nullable(),
  synthetics: z
    .object({
      total: z.number(),
      failing: z.number(),
      items: z.array(SyntheticMonitorDataSchema).optional(),
    })
    .nullable(),
  deployments: z
    .object({
      recent: z.array(
        z.object({
          id: z.string(),
          service: z.string(),
          version: z.string(),
          timestamp: z.number(),
          status: z.enum(["SUCCESS", "FAILED"]),
        }),
      ),
    })
    .nullable(),
});

export type StatusDashboard = z.infer<typeof StatusDashboardSchema>;

/**
 * Check if there are any health issues
 */
export function hasIssues(status: StatusDashboard): boolean {
  if (status.problems && status.problems.total > 0) return true;
  if (status.slos && status.slos.violated > 0) return true;
  if (status.synthetics && status.synthetics.failing > 0) return true;
  return false;
}

/**
 * Get severity level of the dashboard
 */
export function getDashboardSeverity(status: StatusDashboard): "critical" | "warning" | "healthy" {
  if (!status.problems && !status.slos && !status.synthetics) {
    return "healthy";
  }

  if (status.problems?.bySeverity[ProblemSeverity.CRITICAL]! > 0) {
    return "critical";
  }

  if (
    (status.problems && status.problems.total > 0) ||
    (status.slos && status.slos.violated > 0) ||
    (status.synthetics && status.synthetics.failing > 0)
  ) {
    return "warning";
  }

  return "healthy";
}

/**
 * Format timestamp for display
 */
export function formatLastChecked(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return `${days} day ago`;
}
