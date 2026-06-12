// Dynatrace Status Dashboard — pure helpers, contract-aligned with the
// data sources used elsewhere in the extension:
//   problems   → Grail dt.davis.problems (classification via event.category)
//   synthetics → /api/v2/synthetic/monitors (no fabricated execution metrics)
import type { Problem } from "./problem";
import type { SyntheticMonitorData } from "./synthetic";
import { ExecutionStatus } from "./synthetic";

export type DashboardSeverity = "critical" | "warning" | "healthy" | "unknown";

/** null in a section means "data unavailable" — never "all clear". */
export interface StatusSnapshot {
  lastChecked: number;
  problems: Problem[] | null;
  synthetics: SyntheticMonitorData[] | null;
}

export function countAvailabilityProblems(problems: Problem[]): number {
  return problems.filter((p) => p["event.category"] === "AVAILABILITY").length;
}

export function countFailingMonitors(monitors: SyntheticMonitorData[]): number {
  return monitors.filter((m) => m.lastExecution && m.lastExecution.status !== ExecutionStatus.OK).length;
}

export function hasIssues(status: StatusSnapshot): boolean {
  if (status.problems && status.problems.length > 0) return true;
  if (status.synthetics && countFailingMonitors(status.synthetics) > 0) return true;
  return false;
}

/**
 * Overall dashboard severity.
 * "unknown" is returned when no issues were found but at least one data source
 * was unavailable — an unreachable API must never look healthy.
 */
export function getDashboardSeverity(status: StatusSnapshot): DashboardSeverity {
  const availabilityProblems = status.problems ? countAvailabilityProblems(status.problems) : 0;

  if (availabilityProblems > 0) return "critical";

  const openProblems = status.problems?.length ?? 0;
  const failingMonitors = status.synthetics ? countFailingMonitors(status.synthetics) : 0;
  if (openProblems > 0 || failingMonitors > 0) return "warning";

  const anyUnavailable = status.problems === null || status.synthetics === null;
  if (anyUnavailable) return "unknown";

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
