// src/lib/types/problem.ts
import { z } from "zod";

export const problemSchema = z.object({
  "event.id": z.string(),
  "event.name": z.string(),
  "event.status": z.enum(["OPEN", "CLOSED"]),
  "event.severity": z.enum(["AVAILABILITY", "ERROR", "PERFORMANCE", "RESOURCE_CONTENTION", "CUSTOM_ALERT"]),
  "event.start": z.string().datetime(),
  "event.end": z.string().datetime().nullable().optional(),
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

  parts.push("sort event.severity asc, event.start desc");
  parts.push(`limit ${limit}`);

  return parts.join(" | ");
}

export function getProblemsTimeframe(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days back
  return { start: start.toISOString(), end: end.toISOString() };
}
