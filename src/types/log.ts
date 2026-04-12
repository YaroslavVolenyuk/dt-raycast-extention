// types/log.ts
// Single source of truth for log record shape returned by Dynatrace Grail API.

export interface LogRecord {
  timestamp: string;
  content: string;
  loglevel: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | string;
  status?: string;
  "service.name"?: string;
  "dt.entity.host"?: string;
  "log.source"?: string;
  [key: string]: unknown; // Grail may return additional dynamic fields
}
