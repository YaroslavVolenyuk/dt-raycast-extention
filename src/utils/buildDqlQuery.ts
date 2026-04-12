// utils/buildDqlQuery.ts
// Builds a DQL (Dynatrace Query Language) string for log fetching.

export type LogLevel = "error" | "warning" | "info" | "debug" | "fatal" | "all";

const LOG_LEVEL_MAP: Record<LogLevel, string | null> = {
  error: "ERROR",
  warning: "WARN",
  info: "INFO",
  debug: "DEBUG",
  fatal: "FATAL",
  all: null, // no filter — fetch everything
};

interface BuildDqlOptions {
  logLevel: LogLevel;
  limit?: number;
  extraFilter?: string; // optional free-text DQL filter appended with |
}

/**
 * Returns a DQL query string for Dynatrace Grail log search.
 *
 * Example output:
 *   fetch logs | filter loglevel == "ERROR" | sort timestamp desc | limit 50
 */
export function buildDqlQuery({ logLevel, limit = 50, extraFilter }: BuildDqlOptions): string {
  const parts: string[] = ["fetch logs"];

  const level = LOG_LEVEL_MAP[logLevel];
  if (level !== null) {
    parts.push(`filter loglevel == "${level}"`);
  }

  if (extraFilter) {
    parts.push(extraFilter.trim());
  }

  parts.push("sort timestamp desc");
  parts.push(`limit ${limit}`);

  return parts.join(" | ");
}
