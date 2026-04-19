import { List, ActionPanel, Action, Icon, LocalStorage } from "@raycast/api";
import LogDetailView from "./log-detail-view";
import { useDynatraceQuery } from "./useDynatraceQuery";
import { parseTimeframe } from "./utils/parseTimeframe";
import { buildDqlQuery, LogLevel } from "./utils/buildDqlQuery";
import { LogRecord } from "./types/log";
import { useEffect, useState, useMemo } from "react";

// ── Persistence keys ───────────────────────────────────────────────────────
const KEY_TIMEFRAME = "dt_last_timeframe";
const KEY_APP_FILTER = "dt_last_app_filter";

interface CommandArguments {
  timeframeValue: string; // e.g. "2", "30" — numeric part
  timeframeUnit: "h" | "m" | "d"; // from dropdown, defaults to "h" (Hours)
  query: LogLevel; // "error" | "warning" | "info" | ...
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
  const effectiveLogLevel: LogLevel = logLevel ?? "error";

  // ── Story 4: persistent filter state ──────────────────────────────────────
  // storedTimeframe is loaded from LocalStorage and used when command arg is empty
  const [storedTimeframe, setStoredTimeframe] = useState<string | null>(null);
  // Story 3: app/service filter
  const [selectedService, setSelectedService] = useState<string>("all");
  // Gate: don't fire query until LocalStorage is loaded
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Effective timeframe: command arg wins → stored value → default "24h"
  const timeframe = timeframeValue
    ? `${timeframeValue}${timeframeUnit ?? "h"}`
    : (storedTimeframe ?? "24h");

  const { data, isLoading, error, execute } = useDynatraceQuery<LogRecord>();

  // Load persisted filters once on mount
  useEffect(() => {
    Promise.all([
      LocalStorage.getItem<string>(KEY_TIMEFRAME),
      LocalStorage.getItem<string>(KEY_APP_FILTER),
    ]).then(([tf, svc]) => {
      if (!timeframeValue && tf) setStoredTimeframe(tf);
      if (svc) setSelectedService(svc);
      setFiltersLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally once

  // Execute query after persisted filters are loaded; re-run if args change
  useEffect(() => {
    if (!filtersLoaded) return;
    const timeRange = parseTimeframe(timeframe);
    const dql = buildDqlQuery({ logLevel: effectiveLogLevel });
    execute(dql, timeRange);
    // Persist effective timeframe so next launch can restore it
    LocalStorage.setItem(KEY_TIMEFRAME, timeframe);
  }, [timeframe, effectiveLogLevel, filtersLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update service selection and persist immediately
  const handleServiceChange = (value: string) => {
    setSelectedService(value);
    LocalStorage.setItem(KEY_APP_FILTER, value);
  };

  const logs = data?.records ?? [];

  // ── Story 3: collect unique service / app names from current results ───────
  const serviceOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const log of logs) {
      const s = (log["service.name"] ?? log["dt.app.name"]) as string | undefined;
      if (s) seen.add(s);
    }
    return Array.from(seen).sort();
  }, [logs]);

  // Apply service/app filter on top of the API results (client-side)
  const filteredLogs = useMemo(() => {
    if (selectedService === "all") return logs;
    return logs.filter((log) => {
      const s = (log["service.name"] ?? log["dt.app.name"]) as string | undefined;
      return s === selectedService;
    });
  }, [logs, selectedService]);

  // Show dropdown only when there are ≥2 unique services (Story 3)
  const serviceDropdown =
    serviceOptions.length >= 2 ? (
      <List.Dropdown
        tooltip="Filter by App / Service"
        value={selectedService}
        onChange={handleServiceChange}
      >
        <List.Dropdown.Item title="All Apps" value="all" />
        <List.Dropdown.Section title="Services">
          {serviceOptions.map((s) => (
            <List.Dropdown.Item key={s} title={s} value={s} />
          ))}
        </List.Dropdown.Section>
      </List.Dropdown>
    ) : undefined;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!isLoading && !error && filteredLogs.length === 0 && data !== null) {
    return (
      <List isLoading={false} searchBarPlaceholder="Search logs..." searchBarAccessory={serviceDropdown}>
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No logs found"
          description={`No ${effectiveLogLevel.toUpperCase()} logs for the last ${timeframe}.`}
        />
      </List>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
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
                  const dql = buildDqlQuery({ logLevel: effectiveLogLevel });
                  execute(dql, timeRange);
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search logs by content or service..."
      searchBarAccessory={serviceDropdown}
    >
      {filteredLogs.map((log, index) => (
        <List.Item
          key={index}
          icon={getLogIcon(log.loglevel)}
          title={(log["service.name"] ?? log["dt.app.name"] ?? "Unknown Service") as string}
          subtitle={log.content}
          accessories={[
            {
              tag: {
                value: log.loglevel,
                color: log.loglevel === "ERROR" || log.loglevel === "FATAL" ? "#e85555" : undefined,
              },
            },
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
