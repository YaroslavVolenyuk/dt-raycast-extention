// src/lib/types/problem.ts
import { z } from "zod";

/**
 * Davis problem categories as returned by Grail `dt.davis.problems` in `event.category`.
 * Verified against a live tenant (2026-06): AVAILABILITY | ERROR | CUSTOM_ALERT | SLOWDOWN.
 * Note: Grail uses SLOWDOWN where the classic REST API used PERFORMANCE.
 */
export const PROBLEM_CATEGORIES = [
  "AVAILABILITY",
  "ERROR",
  "SLOWDOWN",
  "RESOURCE_CONTENTION",
  "CUSTOM_ALERT",
  "MONITORING_UNAVAILABLE",
  "INFO",
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export const problemSchema = z.object({
  "event.id": z.string(),
  "event.name": z.string(),
  "event.status": z.enum(["OPEN", "CLOSED"]),
  // Classification field. Unknown future categories must not drop the record.
  "event.category": z.enum(PROBLEM_CATEGORIES).or(z.string()),
  // Numeric string on real tenants (e.g. "3") — display as-is, never classify by it.
  "event.severity": z.string().optional(),
  "event.start": z.string().datetime(),
  "event.end": z.string().datetime().nullable().optional(),
  display_id: z.string().optional(),
  affected_entity_ids: z.array(z.string()).optional(),
  maintenance_window: z.boolean().optional(),
  root_cause_entity_id: z.string().nullable().optional(),
});

export type Problem = z.infer<typeof problemSchema>;

export function buildProblemsQuery(status: "OPEN" | "ALL" = "OPEN", limit = 50): string {
  const statusFilter = status === "OPEN" ? 'event.status == "OPEN"' : "";
  const parts = ["fetch dt.davis.problems"];

  if (statusFilter) {
    parts.push(`filter ${statusFilter}`);
  }

  parts.push("sort event.start desc");
  parts.push(`limit ${limit}`);

  return parts.join(" | ");
}

export function getProblemsTimeframe(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days back
  return { start: start.toISOString(), end: end.toISOString() };
}
