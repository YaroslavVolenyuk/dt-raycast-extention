// src/lib/types/settings.ts
import { z } from "zod";

// Settings schema IDs always use builtin: prefix in Dynatrace Settings v2
export const settingsTypeSchema = z.string().regex(/^builtin:/, { message: "schemaId must start with 'builtin:'" });

export type SettingsType = string;

// Settings scope (where the setting applies)
export const settingsScopeSchema = z.enum(["ENVIRONMENT", "MANAGEMENT_ZONE", "ENTITY", "APPLICATION"]);

export type SettingsScope = z.infer<typeof settingsScopeSchema>;

// Single settings object
export const settingsObjectSchema = z.object({
  id: z.string(),
  schemaId: settingsTypeSchema,
  schemaVersion: z.string().optional(),
  objectId: z.string(),
  displayName: z.string(),
  description: z.string().nullable().optional(),
  scope: settingsScopeSchema.optional(),
  author: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
  value: z.object({}).passthrough(), // JSON object (any structure)
  isModified: z.boolean().default(false),
});

export const settingsListSchema = z.array(settingsObjectSchema);

export const settingsApiResponseSchema = z.object({
  items: z.array(settingsObjectSchema),
  totalCount: z.number().optional(),
  nextPageKey: z.string().optional(),
});

export type SettingsObject = z.infer<typeof settingsObjectSchema>;

// Settings filter/search parameters
export const settingsFilterSchema = z.object({
  schemaId: settingsTypeSchema.optional(),
  searchText: z.string().optional(),
  scope: settingsScopeSchema.optional(),
});

export type SettingsFilter = z.infer<typeof settingsFilterSchema>;

// Settings type metadata
export interface SettingsTypeInfo {
  id: SettingsType;
  label: string;
  description: string;
  icon: string;
}

export const SETTINGS_TYPES: SettingsTypeInfo[] = [
  {
    id: "builtin:alerting.profile",
    label: "Alerting Profiles",
    description: "Configure alert notification rules and recipients",
    icon: "🔔",
  },
  {
    id: "builtin:management-zones",
    label: "Management Zones",
    description: "Define logical groupings of monitored entities",
    icon: "🎯",
  },
  {
    id: "builtin:tags.auto-tagging",
    label: "Auto-Tags",
    description: "Automatically tag entities based on rules",
    icon: "🏷️",
  },
  {
    id: "builtin:maintenance-window",
    label: "Maintenance Windows",
    description: "Schedule maintenance periods to suppress alerts",
    icon: "🛠️",
  },
  {
    id: "builtin:notification",
    label: "Notifications",
    description: "Configure notification integrations",
    icon: "📬",
  },
  {
    id: "builtin:ownership.teams",
    label: "Ownership Teams",
    description: "Define team ownership for services and components",
    icon: "👥",
  },
  {
    id: "builtin:automation.rule",
    label: "Automation Rules",
    description: "Configure automated actions and responses",
    icon: "⚙️",
  },
  {
    id: "builtin:service-api.request-attributes",
    label: "Request Attributes",
    description: "Extract and configure custom request attributes",
    icon: "📋",
  },
];

export function getSettingsTypeLabel(schemaId: string): string {
  const typeInfo = SETTINGS_TYPES.find((t) => t.id === schemaId);
  return typeInfo ? typeInfo.label : schemaId;
}

export function getSettingsTypeIcon(schemaId: string): string {
  const typeInfo = SETTINGS_TYPES.find((t) => t.id === schemaId);
  return typeInfo ? typeInfo.icon : "⚙️";
}
