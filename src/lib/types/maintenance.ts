import { z } from "zod";

/**
 * Dynatrace Maintenance Window types.
 * Display model derived from the Settings 2.0 object
 * `builtin:alerting.maintenance-window` (see src/lib/api/maintenance.ts for the
 * raw API value schema and the mapper).
 */

export enum MaintenanceWindowStatus {
  ACTIVE = "ACTIVE",
  SCHEDULED = "SCHEDULED",
  PAST = "PAST",
}

export const MAINTENANCE_TYPES = ["PLANNED", "UNPLANNED"] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const SCHEDULE_TYPES = ["ONCE", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type MaintenanceScheduleType = (typeof SCHEDULE_TYPES)[number];

export const SUPPRESSION_MODES = [
  "DETECT_PROBLEMS_AND_ALERT",
  "DETECT_PROBLEMS_DONT_ALERT",
  "DONT_DETECT_PROBLEMS",
] as const;
export type MaintenanceSuppression = (typeof SUPPRESSION_MODES)[number];

export const MaintenanceFilterSchema = z.object({
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  entityTags: z.array(z.string()).optional(),
  managementZones: z.array(z.string()).optional(),
});

export type MaintenanceFilter = z.infer<typeof MaintenanceFilterSchema>;

export const MaintenanceWindowSchema = z.object({
  id: z.string().describe("Settings objectId"),
  name: z.string(),
  description: z.string().nullable().optional(),
  maintenanceType: z.enum(MAINTENANCE_TYPES),
  scheduleType: z.enum(SCHEDULE_TYPES),
  suppression: z.enum(SUPPRESSION_MODES),
  disableSyntheticMonitorExecution: z.boolean().optional(),
  /** Epoch ms — present for ONCE windows; recurring windows expose the recurrence range. */
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  timeZone: z.string().optional(),
  enabled: z.boolean().default(true),
  filters: z.array(MaintenanceFilterSchema).optional(),
});

export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>;

/**
 * Determine maintenance window status based on current time.
 * Windows without resolvable times (recurring without range) are treated as SCHEDULED.
 */
export function getMaintenanceStatus(window: MaintenanceWindow): MaintenanceWindowStatus {
  if (window.startTime == null || window.endTime == null) {
    return MaintenanceWindowStatus.SCHEDULED;
  }

  const now = Date.now();
  if (now >= window.startTime && now <= window.endTime) {
    return MaintenanceWindowStatus.ACTIVE;
  }
  if (now < window.startTime) {
    return MaintenanceWindowStatus.SCHEDULED;
  }
  return MaintenanceWindowStatus.PAST;
}

/**
 * Format maintenance window for display
 */
export function formatMaintenanceTime(timestamp: number | undefined): string {
  if (timestamp == null) return "—";
  return new Date(timestamp).toLocaleString();
}

/** Human-readable suppression mode. */
export function getSuppressionDisplay(suppression: MaintenanceSuppression): string {
  switch (suppression) {
    case "DETECT_PROBLEMS_AND_ALERT":
      return "Detect problems and alert";
    case "DETECT_PROBLEMS_DONT_ALERT":
      return "Detect problems, don't alert";
    case "DONT_DETECT_PROBLEMS":
      return "Don't detect problems";
  }
}

/** Human-readable scope summary from Settings 2.0 filters. */
export function getScopeDisplay(filters?: MaintenanceFilter[] | null): string {
  if (!filters || filters.length === 0) return "All Environment";

  const parts = filters.map((f) => {
    if (f.entityId) return `Entity: ${f.entityId}`;
    if (f.managementZones && f.managementZones.length > 0) {
      return `Management Zones: ${f.managementZones.join(", ")}`;
    }
    if (f.entityType) return `Entity type: ${f.entityType}`;
    return "Filter";
  });
  return parts.join(" • ");
}

/**
 * Sort maintenance windows: ACTIVE → SCHEDULED → PAST
 */
export function sortMaintenanceWindows(windows: MaintenanceWindow[]): MaintenanceWindow[] {
  const statusOrder = {
    [MaintenanceWindowStatus.ACTIVE]: 0,
    [MaintenanceWindowStatus.SCHEDULED]: 1,
    [MaintenanceWindowStatus.PAST]: 2,
  };

  return [...windows].sort((a, b) => {
    const statusA = getMaintenanceStatus(a);
    const statusB = getMaintenanceStatus(b);

    const orderA = statusOrder[statusA];
    const orderB = statusOrder[statusB];

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const aStart = a.startTime ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.startTime ?? Number.MAX_SAFE_INTEGER;
    const aEnd = a.endTime ?? 0;
    const bEnd = b.endTime ?? 0;

    // Within same status, sort by time (active/scheduled: earliest first, past: latest first)
    if (statusA === MaintenanceWindowStatus.PAST) {
      return bEnd - aEnd;
    }
    return aStart - bStart;
  });
}
