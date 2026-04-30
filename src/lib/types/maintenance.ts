import { z } from "zod";

/**
 * Dynatrace Maintenance Window types
 */

export enum MaintenanceWindowType {
  PLANNED = "PLANNED",
  ONE_TIME = "ONE_TIME",
  RECURRING = "RECURRING",
}

export enum MaintenanceWindowStatus {
  ACTIVE = "ACTIVE",
  SCHEDULED = "SCHEDULED",
  PAST = "PAST",
}

export enum MaintenanceScopeType {
  ENVIRONMENT = "ENVIRONMENT",
  MANAGEMENT_ZONE = "MANAGEMENT_ZONE",
  ENTITY = "ENTITY",
}

export const MaintenanceWindowSchema = z.object({
  id: z.string().describe("Unique identifier"),
  name: z.string().describe("Maintenance window name"),
  type: z.nativeEnum(MaintenanceWindowType),
  description: z.string().optional(),
  startTime: z.number().describe("Start timestamp (ms)"),
  endTime: z.number().describe("End timestamp (ms)"),
  suppressAlertingEnabled: z.boolean().default(true),
  suppressProblemsEnabled: z.boolean().default(false),
  scope: z
    .object({
      type: z.nativeEnum(MaintenanceScopeType),
      value: z.string().optional().describe("Zone ID or Entity ID"),
    })
    .optional(),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
  modifiedAt: z.number().optional(),
  enabled: z.boolean().default(true),
});

export const MaintenanceWindowListSchema = z.array(MaintenanceWindowSchema);

export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>;

/**
 * Determine maintenance window status based on current time
 */
export function getMaintenanceStatus(window: MaintenanceWindow): MaintenanceWindowStatus {
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
export function formatMaintenanceTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get scope display name
 */
export function getScopeDisplay(scope?: MaintenanceWindow["scope"]): string {
  if (!scope) return "All Environment";

  switch (scope.type) {
    case MaintenanceScopeType.MANAGEMENT_ZONE:
      return `Management Zone: ${scope.value || ""}`;
    case MaintenanceScopeType.ENTITY:
      return `Entity: ${scope.value || ""}`;
    default:
      return "All Environment";
  }
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

    // Within same status, sort by time (active/scheduled: earliest first, past: latest first)
    if (statusA === MaintenanceWindowStatus.PAST) {
      return b.endTime - a.endTime;
    }
    return a.startTime - b.startTime;
  });
}
