// src/lib/api/maintenance.ts
// Maintenance windows via the Settings 2.0 API (`builtin:alerting.maintenance-window`).
//
// Contract notes (docs.dynatrace.com, Settings API v2):
//   - GET  /api/v2/settings/objects?schemaIds=builtin:alerting.maintenance-window
//     returns { items: [{ objectId, value: {...} }], totalCount, pageSize, nextPageKey }
//   - POST /api/v2/settings/objects expects an ARRAY of
//     { schemaId, scope: "environment", value } objects — NOT a single bare object.
//     `validateOnly=true` dry-runs the payload without persisting.
//   - DELETE /api/v2/settings/objects/{objectId} removes one object.
//   - The value shape is generalProperties + schedule (+ filters), with local
//     date-times like "2026-06-12T02:00:00" and an explicit timeZone.

import { z } from "zod";
import { dynatraceRest, registerMock } from "./rest";
import type { TenantConfig } from "../auth";
import {
  MaintenanceWindow,
  MaintenanceType,
  MaintenanceSuppression,
  MaintenanceFilterSchema,
  MAINTENANCE_TYPES,
  SUPPRESSION_MODES,
  SCHEDULE_TYPES,
} from "../types/maintenance";

export const MAINTENANCE_SCHEMA_ID = "builtin:alerting.maintenance-window";
export const SETTINGS_OBJECTS_PATH = "/api/v2/settings/objects";

// ── Raw Settings 2.0 value schema ────────────────────────────────────────────

const onceRecurrenceSchema = z.object({
  startTime: z.string(), // local date-time, e.g. "2026-06-12T02:00:00"
  endTime: z.string(),
  timeZone: z.string().optional(),
});

const recurrenceRangeSchema = z.object({
  scheduleStartDate: z.string().optional(), // "2026-06-12"
  scheduleEndDate: z.string().optional(),
});

const maintenanceValueSchema = z.object({
  enabled: z.boolean().default(true),
  generalProperties: z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    maintenanceType: z.enum(MAINTENANCE_TYPES),
    suppression: z.enum(SUPPRESSION_MODES),
    disableSyntheticMonitorExecution: z.boolean().optional(),
  }),
  schedule: z.object({
    scheduleType: z.enum(SCHEDULE_TYPES),
    onceRecurrence: onceRecurrenceSchema.optional(),
    dailyRecurrence: z.object({ recurrenceRange: recurrenceRangeSchema.optional() }).passthrough().optional(),
    weeklyRecurrence: z.object({ recurrenceRange: recurrenceRangeSchema.optional() }).passthrough().optional(),
    monthlyRecurrence: z.object({ recurrenceRange: recurrenceRangeSchema.optional() }).passthrough().optional(),
  }),
  filters: z.array(MaintenanceFilterSchema).optional(),
});

export type MaintenanceValue = z.infer<typeof maintenanceValueSchema>;

export const settingsObjectItemSchema = z.object({
  objectId: z.string(),
  value: z.unknown(),
});

export const settingsObjectsResponseSchema = z.object({
  items: z.array(settingsObjectItemSchema),
  totalCount: z.number().optional(),
  pageSize: z.number().optional(),
  nextPageKey: z.string().nullable().optional(),
});

// ── Mapper: raw value → display model ───────────────────────────────────────

function localDateTimeToEpoch(dateTime: string): number | undefined {
  const ms = new Date(dateTime).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function settingsItemToMaintenanceWindow(item: { objectId: string; value: unknown }): MaintenanceWindow | null {
  const parsed = maintenanceValueSchema.safeParse(item.value);
  if (!parsed.success) return null;
  const v = parsed.data;

  let startTime: number | undefined;
  let endTime: number | undefined;

  if (v.schedule.scheduleType === "ONCE" && v.schedule.onceRecurrence) {
    startTime = localDateTimeToEpoch(v.schedule.onceRecurrence.startTime);
    endTime = localDateTimeToEpoch(v.schedule.onceRecurrence.endTime);
  } else {
    const range =
      v.schedule.dailyRecurrence?.recurrenceRange ??
      v.schedule.weeklyRecurrence?.recurrenceRange ??
      v.schedule.monthlyRecurrence?.recurrenceRange;
    if (range?.scheduleStartDate) startTime = localDateTimeToEpoch(`${range.scheduleStartDate}T00:00:00`);
    if (range?.scheduleEndDate) endTime = localDateTimeToEpoch(`${range.scheduleEndDate}T23:59:59`);
  }

  return {
    id: item.objectId,
    name: v.generalProperties.name,
    description: v.generalProperties.description ?? undefined,
    maintenanceType: v.generalProperties.maintenanceType,
    scheduleType: v.schedule.scheduleType,
    suppression: v.generalProperties.suppression,
    disableSyntheticMonitorExecution: v.generalProperties.disableSyntheticMonitorExecution,
    startTime,
    endTime,
    timeZone: v.schedule.onceRecurrence?.timeZone,
    enabled: v.enabled,
    filters: v.filters,
  };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export interface MaintenanceFetchResult {
  windows: MaintenanceWindow[];
  /** Items whose value did not match the expected schema. */
  skipped: number;
}

export async function fetchMaintenanceWindows(tenant: TenantConfig): Promise<MaintenanceFetchResult> {
  const response = await dynatraceRest(tenant, SETTINGS_OBJECTS_PATH, {
    schema: settingsObjectsResponseSchema,
    queryParams: {
      schemaIds: MAINTENANCE_SCHEMA_ID,
      fields: "objectId,value",
      pageSize: "100",
    },
  });

  let skipped = 0;
  const windows: MaintenanceWindow[] = [];
  for (const item of response.data.items) {
    const mapped = settingsItemToMaintenanceWindow(item);
    if (mapped) {
      windows.push(mapped);
    } else {
      skipped++;
    }
  }
  return { windows, skipped };
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateMaintenanceInput {
  name: string;
  description?: string;
  maintenanceType: MaintenanceType;
  suppression: MaintenanceSuppression;
  disableSyntheticMonitorExecution?: boolean;
  /** Local date-times without zone suffix, e.g. "2026-06-12T02:00:00". */
  startTime: string;
  endTime: string;
  timeZone: string;
  /** Optional single filter (entity or management zone). */
  entityId?: string;
  managementZone?: string;
}

export function buildCreateMaintenancePayload(input: CreateMaintenanceInput): Array<Record<string, unknown>> {
  const filters: Array<Record<string, unknown>> = [];
  if (input.entityId) {
    filters.push({ entityId: input.entityId });
  } else if (input.managementZone) {
    filters.push({ managementZones: [input.managementZone] });
  }

  const value: Record<string, unknown> = {
    enabled: true,
    generalProperties: {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      maintenanceType: input.maintenanceType,
      suppression: input.suppression,
      disableSyntheticMonitorExecution: input.disableSyntheticMonitorExecution ?? false,
    },
    schedule: {
      scheduleType: "ONCE",
      onceRecurrence: {
        startTime: input.startTime,
        endTime: input.endTime,
        timeZone: input.timeZone,
      },
    },
    ...(filters.length > 0 ? { filters } : {}),
  };

  // The Settings API requires an ARRAY of objects, each with schemaId and scope.
  return [
    {
      schemaId: MAINTENANCE_SCHEMA_ID,
      scope: "environment",
      value,
    },
  ];
}

const settingsWriteResponseSchema = z.array(
  z.object({
    code: z.number().optional(),
    objectId: z.string().optional(),
    error: z.unknown().optional(),
  }),
);

/**
 * Creates a maintenance window. Runs a `validateOnly=true` dry run first so a
 * contract mismatch surfaces as a clear validation error instead of a persisted
 * broken object.
 */
export async function createMaintenanceWindow(tenant: TenantConfig, input: CreateMaintenanceInput): Promise<string> {
  const payload = buildCreateMaintenancePayload(input);

  // Dry run — the API validates the payload without persisting.
  await dynatraceRest(tenant, SETTINGS_OBJECTS_PATH, {
    method: "POST",
    body: payload,
    queryParams: { validateOnly: "true" },
  });

  const response = await dynatraceRest(tenant, SETTINGS_OBJECTS_PATH, {
    method: "POST",
    body: payload,
    schema: settingsWriteResponseSchema,
  });

  const first = response.data[0];
  if (first?.error) {
    throw new Error(`Settings API rejected the maintenance window: ${JSON.stringify(first.error).slice(0, 300)}`);
  }
  return first?.objectId ?? "";
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteMaintenanceWindow(tenant: TenantConfig, objectId: string): Promise<void> {
  await dynatraceRest(tenant, `${SETTINGS_OBJECTS_PATH}/${encodeURIComponent(objectId)}`, {
    method: "DELETE",
  });
}

// ── Mock data (module-level registration — V13) ─────────────────────────────

const now = Date.now();
const h = 60 * 60 * 1000;

function toLocalDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export const MOCK_MAINTENANCE_ITEMS = [
  {
    objectId: "mw-mock-active",
    value: {
      enabled: true,
      generalProperties: {
        name: "Database upgrade (active)",
        description: "Planned DB maintenance",
        maintenanceType: "PLANNED",
        suppression: "DETECT_PROBLEMS_DONT_ALERT",
        disableSyntheticMonitorExecution: false,
      },
      schedule: {
        scheduleType: "ONCE",
        onceRecurrence: {
          startTime: toLocalDateTime(now - 1 * h),
          endTime: toLocalDateTime(now + 1 * h),
          timeZone: "UTC",
        },
      },
    },
  },
  {
    objectId: "mw-mock-scheduled",
    value: {
      enabled: true,
      generalProperties: {
        name: "Network switch replacement",
        maintenanceType: "UNPLANNED",
        suppression: "DONT_DETECT_PROBLEMS",
        disableSyntheticMonitorExecution: true,
      },
      schedule: {
        scheduleType: "ONCE",
        onceRecurrence: {
          startTime: toLocalDateTime(now + 24 * h),
          endTime: toLocalDateTime(now + 26 * h),
          timeZone: "UTC",
        },
      },
      filters: [{ managementZones: ["zone-prod"] }],
    },
  },
  {
    objectId: "mw-mock-past",
    value: {
      enabled: true,
      generalProperties: {
        name: "Quarterly patching (done)",
        maintenanceType: "PLANNED",
        suppression: "DETECT_PROBLEMS_AND_ALERT",
      },
      schedule: {
        scheduleType: "ONCE",
        onceRecurrence: {
          startTime: toLocalDateTime(now - 50 * h),
          endTime: toLocalDateTime(now - 48 * h),
          timeZone: "UTC",
        },
      },
    },
  },
];

// RegExp keyed on the maintenance schemaId so the generic settings command's
// mock for the same path does not collide with this one.
registerMock(/^\/api\/v2\/settings\/objects\?.*alerting\.maintenance-window/, {
  items: MOCK_MAINTENANCE_ITEMS,
  totalCount: MOCK_MAINTENANCE_ITEMS.length,
  pageSize: 100,
});
