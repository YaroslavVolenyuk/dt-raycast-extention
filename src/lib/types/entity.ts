// src/lib/types/entity.ts
import { z } from "zod";
import { escapeDqlString } from "../dql/escape";

// smartscapeNodes returns id/name/type (no "entity." prefix)
export const entitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

export type Entity = z.infer<typeof entitySchema>;

export function buildEntityQuery(type: string, query: string): string {
  // fetch dt.entity.* is not universally supported; smartscapeNodes works on all envs
  const typeMap: Record<string, string> = {
    all: "*",
    service: "SERVICE",
    host: "HOST",
    process_group: "PROCESS_GROUP",
  };

  const nodeType = typeMap[type] ?? "*";

  if (!query || query.length < 2) {
    return `smartscapeNodes "${nodeType}" | limit 20`;
  }

  return `smartscapeNodes "${nodeType}" | filter matchesPhrase(name, "${escapeDqlString(query)}") | limit 20`;
}
