// src/lib/api/settings.ts
// Settings 2.0 objects listing for the dt-settings command.
//
// Contract notes (Settings API v2):
//   - GET /api/v2/settings/objects requires `schemaIds` (or `externalIds`) on the
//     first page — calling with only `scopes` returns 400 "Mandatory parameter missing".
//   - Item fields must be requested explicitly via `fields`; `created`/`modified`
//     are epoch ms numbers, `summary` is the human-readable label.

import { z } from "zod";
import { dynatraceRest, registerMock } from "./rest";
import type { TenantConfig } from "../auth";
import type { SettingsObject } from "../types/settings";
import { getSettingsTypeLabel } from "../types/settings";
import { MOCK_SETTINGS } from "./mock";

export const SETTINGS_OBJECTS_PATH = "/api/v2/settings/objects";

// Schemas the command browses — matches the command description
// (alerting, zones, tags, ownership, notifications). Maintenance windows have
// their own command (dt-maintenance) and are intentionally not listed here.
export const BROWSABLE_SCHEMA_IDS = [
  "builtin:alerting.profile",
  "builtin:management-zones",
  "builtin:tags.auto-tagging",
  "builtin:problem.notifications",
  "builtin:ownership.teams",
] as const;

// ── Raw API item schema ──────────────────────────────────────────────────────

const settingsApiItemSchema = z
  .object({
    objectId: z.string(),
    schemaId: z.string().optional(),
    schemaVersion: z.string().optional(),
    scope: z.string().optional(),
    summary: z.string().optional(),
    author: z.string().optional(),
    created: z.number().optional(),
    modified: z.number().optional(),
    value: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const settingsApiResponseSchema = z.object({
  items: z.array(settingsApiItemSchema),
  totalCount: z.number().optional(),
  pageSize: z.number().optional(),
  nextPageKey: z.string().nullable().optional(),
});

type SettingsApiItem = z.infer<typeof settingsApiItemSchema>;

// ── Mapper ───────────────────────────────────────────────────────────────────

export function settingsApiItemToDisplay(item: SettingsApiItem): SettingsObject {
  const schemaId = item.schemaId ?? "builtin:unknown";
  return {
    id: item.objectId,
    objectId: item.objectId,
    schemaId,
    schemaVersion: item.schemaVersion,
    displayName: item.summary ?? getSettingsTypeLabel(schemaId),
    scope: item.scope,
    author: item.author,
    createdAt: item.created != null ? new Date(item.created).toISOString() : undefined,
    modifiedAt: item.modified != null ? new Date(item.modified).toISOString() : undefined,
    value: item.value ?? {},
    isModified: false,
  };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchSettingsObjects(tenant: TenantConfig): Promise<SettingsObject[]> {
  const response = await dynatraceRest(tenant, SETTINGS_OBJECTS_PATH, {
    schema: settingsApiResponseSchema,
    queryParams: {
      schemaIds: BROWSABLE_SCHEMA_IDS.join(","),
      fields: "objectId,schemaId,schemaVersion,scope,summary,author,created,modified,value",
      pageSize: "100",
    },
  });

  return response.data.items.map(settingsApiItemToDisplay);
}

// ── Mock (module-level registration — V13) ──────────────────────────────────
// Negative lookahead keeps this from swallowing the maintenance command's
// query against the same path.

registerMock(/^\/api\/v2\/settings\/objects\?(?!.*maintenance-window)/, {
  items: MOCK_SETTINGS.map((s) => ({
    objectId: s.objectId,
    schemaId: s.schemaId,
    schemaVersion: s.schemaVersion,
    scope: s.scope,
    summary: s.displayName,
    author: s.author,
    created: s.createdAt ? new Date(s.createdAt).getTime() : undefined,
    modified: s.modifiedAt ? new Date(s.modifiedAt).getTime() : undefined,
    value: s.value,
  })),
  totalCount: MOCK_SETTINGS.length,
  pageSize: 100,
});
