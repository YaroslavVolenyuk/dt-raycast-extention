// src/lib/dql/builders.ts
// Shared DQL query builder functions used across multiple commands.

import { escapeDqlString } from "./escape";
import type { LogRecord } from "../types/log";

/**
 * Builds a context DQL query that finds logs related to a given log record.
 * Filters by service, app, or process name (in order of preference).
 * Does NOT include timestamp filters — caller should apply timeframe separately.
 */
export function buildLogContextQuery(log: LogRecord, limit = 100): string {
  const conditions: string[] = [];

  const service = log["service.name"] ? String(log["service.name"]) : undefined;
  if (service) {
    conditions.push(`service.name == "${escapeDqlString(service)}"`);
  } else {
    const appName = log["dt.app.name"] ? String(log["dt.app.name"]) : undefined;
    if (appName) {
      conditions.push(`dt.app.name == "${escapeDqlString(appName)}"`);
    } else {
      const processName = log["dt.process.name"]
        ? String(log["dt.process.name"])
        : log["dt.process_group.detected_name"]
          ? String(log["dt.process_group.detected_name"])
          : undefined;
      if (processName) {
        conditions.push(`dt.process.name == "${escapeDqlString(processName)}"`);
      }
    }
  }

  if (conditions.length > 0) {
    return `fetch logs\n| filter ${conditions.join("\n    and ")}\n| limit ${limit}`;
  }
  return `fetch logs\n| limit ${limit}`;
}
