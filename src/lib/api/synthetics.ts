// src/lib/api/synthetics.ts
// Dynatrace v2 synthetic monitors API — schema + mapper to SyntheticMonitorData

import { z } from "zod";
import { SyntheticMonitorData, MonitorType, ExecutionStatus } from "../types/synthetic";
import { registerMock } from "./rest";
import { MOCK_SYNTHETICS } from "./mock";

export const SYNTHETICS_PATH = "/api/v2/synthetic/monitors";

// Module-level registration so any command importing this module gets mock data
// before the first fetch starts (V13 — useEffect registration races the request).
registerMock(SYNTHETICS_PATH, {
  monitors: MOCK_SYNTHETICS.map((m) => ({
    entityId: m.monitor.monitorId,
    name: m.monitor.name,
    type: m.monitor.type,
    enabled: m.monitor.enabled,
    locations: m.monitor.locations.map((name) => ({ entityId: name, name })),
    tags: [],
  })),
  totalCount: MOCK_SYNTHETICS.length,
});

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
  // v2 API uses "totalResults"; keep "totalCount" optional for mock compat
  totalResults: z.number().optional(),
  totalCount: z.number().optional(),
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
      // schedule / createdAt / modifiedAt are NOT exposed by the list endpoint —
      // leave them absent instead of fabricating values.
      locations,
    },
    // Availability / failure metrics require a separate execution-results call.
    // Leave undefined — the UI must render "no data", never a fake 100%.
    availability: undefined,
    failureCount: undefined,
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
