// src/lib/api/synthetics.ts
// Dynatrace v2 synthetic monitors API — schema + mapper to SyntheticMonitorData

import { z } from "zod";
import { SyntheticMonitorData, MonitorType, ExecutionStatus } from "../types/synthetic";

// ── v2 API response shape ────────────────────────────────────────────────────

const ApiMonitorTypeSchema = z.enum(["HTTP", "BROWSER", "CLICKPATH"]);

const ApiLocationSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  type: z.string().optional(),
});

const ApiTagSchema = z.object({
  context: z.string().optional(),
  key: z.string(),
  value: z.string().optional(),
});

export const ApiSyntheticMonitorSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  type: ApiMonitorTypeSchema,
  enabled: z.boolean(),
  status: z.enum(["ENABLED", "DISABLED", "INVALID"]).optional(),
  createdFrom: z.string().optional(),
  locations: z.array(ApiLocationSchema).optional().default([]),
  tags: z.array(ApiTagSchema).optional().default([]),
  // HTTP script holds the URL; optional since BROWSER monitors may have a different shape
  script: z
    .object({
      requests: z
        .array(
          z.object({
            url: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type ApiSyntheticMonitor = z.infer<typeof ApiSyntheticMonitorSchema>;

export const SyntheticMonitorListResponseSchema = z.object({
  monitors: z.array(ApiSyntheticMonitorSchema),
  totalCount: z.number(),
});

export type SyntheticMonitorListResponse = z.infer<typeof SyntheticMonitorListResponseSchema>;

// ── Mapper ───────────────────────────────────────────────────────────────────

function toMonitorType(apiType: "HTTP" | "BROWSER" | "CLICKPATH"): MonitorType {
  switch (apiType) {
    case "HTTP":
      return MonitorType.HTTP;
    case "BROWSER":
    case "CLICKPATH":
      return MonitorType.BROWSER;
  }
}

export function apiMonitorToSyntheticMonitorData(m: ApiSyntheticMonitor): SyntheticMonitorData {
  const url = m.script?.requests?.[0]?.url ?? "";
  const locations = (m.locations ?? []).map((l) => l.name);

  return {
    monitor: {
      monitorId: m.entityId,
      name: m.name,
      type: toMonitorType(m.type),
      url,
      enabled: m.enabled,
      schedule: { interval: 5 }, // not exposed in list response
      locations,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
    // Availability and response time require a separate /results call.
    // Default to 100 / undefined so the list renders without errors.
    availability: 100,
    failureCount: 0,
    avgResponseTime: undefined,
    lastExecution:
      m.status === "INVALID"
        ? {
            executionId: "",
            monitorId: m.entityId,
            timestamp: Date.now(),
            status: ExecutionStatus.FAILED,
            locationResults: [],
          }
        : undefined,
  };
}
