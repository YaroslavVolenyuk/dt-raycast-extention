import { List, ActionPanel, Action, Icon } from "@raycast/api";
import LogDetailView from "./log-detail-view";
import { useDynatraceQuery } from "./useDynatraceQuery";
import { parseTimeframe } from "./utils/parseTimeframe";
import { buildDqlQuery, LogLevel } from "./utils/buildDqlQuery";
import { LogRecord } from "./types/log";
import { useEffect } from "react";

interface CommandArguments {
  timeframeValue: string;          // e.g. "2", "30" — numeric part
  timeframeUnit: "h" | "m" | "d"; // from dropdown, defaults to "h" (Hours)
  query: LogLevel;                 // "error" | "warning" | "info"
}

const LOG_LEVEL_ICONS: Record<string, Icon> = {
  ERROR: Icon.XMarkCircle,
  FATAL: Icon.XMarkCircle,
  WARN: Icon.Warning,
  WARNING: Icon.Warning,
  INFO: Icon.Info,
  DEBUG: Icon.Bug,
};

function getLogIcon(loglevel: string): Icon {
  return LOG_LEVEL_ICONS[loglevel?.toUpperCase()] ?? Icon.Document;
}

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function Command(props: { arguments: CommandArguments }) {
  const { timeframeValue, timeframeUnit, query: logLevel } = props.arguments;

  // Combine into a single string for parseTimeframe, e.g. "2h", "30m", "7d"
  // If the user left the value empty, fall back to "24h"
  const timeframe = timeframeValue ? `${timeframeValue}${timeframeUnit ?? "h"}` : "24h";

  const { data, isLoading, error, execute } = useDynatraceQuery<LogRecord>();

  useEffect(() => {
    const timeRange = parseTimeframe(timeframe);
    const dql = buildDqlQuery({ logLevel: logLevel ?? "error" });
    execute(dql, timeRange);
  }, [timeframe, logLevel]);

  const logs = data?.records ?? [];

  // Empty state
  if (!isLoading && !error && logs.length === 0 && data !== null) {
    return (
      <List isLoading={false} searchBarPlaceholder="Search logs...">
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No logs found"
          description={`No ${logLevel.toUpperCase()} logs for the last ${timeframe || "24h"}.`}
        />
      </List>
    );
  }

  // Error state
  if (error && !isLoading) {
    return (
      <List isLoading={false}>
        <List.EmptyView
          icon={Icon.Warning}
          title="Query Failed"
          description={error}
          actions={
            <ActionPanel>
              <Action
                title="Retry"
                icon={Icon.ArrowClockwise}
                onAction={() => {
                  const timeRange = parseTimeframe(timeframe);
                  const dql = buildDqlQuery({ logLevel: logLevel ?? "error" });
                  execute(dql, timeRange);
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search logs by content or service...">
      {logs.map((log, index) => (
        <List.Item
          key={index}
          icon={getLogIcon(log.loglevel)}
          title={log["service.name"] ?? "Unknown Service"}
          subtitle={log.content}
          accessories={[
            { tag: { value: log.loglevel, color: log.loglevel === "ERROR" || log.loglevel === "FATAL" ? "#e85555" : undefined } },
            { text: formatRelativeTime(log.timestamp) },
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="Show Details" target={<LogDetailView log={log} />} />
              <Action.CopyToClipboard content={log.content} title="Copy Log Content" />
              <Action.CopyToClipboard content={log.timestamp} title="Copy Timestamp" />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
