import { List, ActionPanel, Action, Icon, LocalStorage, Color } from "@raycast/api";
import LogDetailView from "./log-detail";
import { useDynatraceQuery } from "../../lib/query";
import { parseTimeframe } from "../../lib/utils/parseTimeframe";
import { buildDqlQuery, LogLevel } from "../../lib/utils/buildDqlQuery";
import { LogRecord } from "../../lib/types/log";
import { getActiveTenant, setActiveTenant } from "../../lib/tenants";
import TenantSwitcher from "../../components/TenantSwitcher";
import EmptyTenantState from "../../components/EmptyTenantState";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { TenantConfig } from "../../lib/auth";

// ── Persistence keys ───────────────────────────────────────────────────────
const KEY_TIMEFRAME = "dt_last_timeframe";
const KEY_LOG_LEVEL = "dt_last_log_level";

interface CommandArguments {
  timeframeValue: string;
  timeframeUnit: "h" | "m" | "d";
  query: LogLevel;
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
  const { timeframeValue, timeframeUnit } = props.arguments;

  // Persist filter state
  const [storedTimeframe, setStoredTimeframe] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [contentSearch, setContentSearch] = useState<string>("");
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantChecked, setTenantChecked] = useState(false);

  // Pagination state
  const [allRecords, setAllRecords] = useState<LogRecord[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Debounce timer for content search
  const [debouncedContent, setDebouncedContent] = useState<string>("");

  // Effective values
  const timeframe = timeframeValue ? `${timeframeValue}${timeframeUnit ?? "h"}` : (storedTimeframe ?? "24h");

  const { data, isLoading, error, execute } = useDynatraceQuery<LogRecord>();

  // Load persisted filters and active tenant once on mount
  useEffect(() => {
    Promise.all([
      LocalStorage.getItem<string>(KEY_TIMEFRAME),
      LocalStorage.getItem<string>(KEY_LOG_LEVEL),
      getActiveTenant(),
    ]).then(([tf, , activeTenant]) => {
      if (!timeframeValue && tf) setStoredTimeframe(tf);
      setTenant(activeTenant);
      setTenantChecked(true);
      setFiltersLoaded(true);
    });
  }, []);

  // Debounce content search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(contentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contentSearch]);

  // Execute query after filters are loaded; re-run if args, tenant, or debounced content changes
  useEffect(() => {
    if (!filtersLoaded || !tenant) return;

    const timeRange = parseTimeframe(timeframe);
    const logLevel = props.arguments.query ?? "error";
    const dql = buildDqlQuery({
      logLevel,
      serviceName: selectedService !== "all" ? selectedService : undefined,
      contentFilter: debouncedContent || undefined,
    });

    execute(dql, timeRange, tenant);

    // Persist effective timeframe and log level
    LocalStorage.setItem(KEY_TIMEFRAME, timeframe);
    LocalStorage.setItem(KEY_LOG_LEVEL, logLevel);

    // Reset pagination when query changes
    setAllRecords([]);
  }, [timeframe, selectedService, debouncedContent, filtersLoaded, tenant, props.arguments.query]);

  // Update data when new results come in (append for "load more", replace on new query)
  useEffect(() => {
    if (data?.records) {
      // If oldest record from last batch exists in new data, we're loading more
      const isLoadMore =
        allRecords.length > 0 && data.records.some((r) => r.timestamp === allRecords[allRecords.length - 1]?.timestamp);

      if (isLoadMore) {
        setAllRecords((prev) => [
          ...prev,
          ...data.records.filter((r) => !prev.some((p) => p.timestamp === r.timestamp)),
        ]);
        setIsLoadingMore(false);
      } else {
        setAllRecords(data.records);
      }
    }
  }, [data]);

  const handleServiceChange = (value: string) => {
    setSelectedService(value);
    setAllRecords([]); // Reset pagination on filter change
  };

  const handleTenantChange = async (id: string) => {
    await setActiveTenant(id);
    const all = await import("../../lib/tenants").then((m) => m.listTenants());
    const next = all.find((t) => t.id === id) ?? null;
    setTenant(next);
  };

  const handleLoadMore = useCallback(async () => {
    if (allRecords.length === 0 || !tenant) return;
    setIsLoadingMore(true);

    const oldestRecord = allRecords[allRecords.length - 1];
    const timeRange = parseTimeframe(timeframe);
    const logLevel = props.arguments.query ?? "error";

    // Build query with "before" cursor for pagination
    const dql = buildDqlQuery({
      logLevel,
      serviceName: selectedService !== "all" ? selectedService : undefined,
      contentFilter: debouncedContent || undefined,
      before: oldestRecord.timestamp,
    });

    execute(dql, timeRange, tenant);
  }, [allRecords, tenant, timeframe, selectedService, debouncedContent, props.arguments.query, execute]);

  // Collect unique service names from current results
  const serviceOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const log of allRecords) {
      const s = (log["service.name"] ?? log["dt.app.name"]) as string | undefined;
      if (s) seen.add(s);
    }
    return Array.from(seen).sort();
  }, [allRecords]);

  if (tenantChecked && !tenant) {
    return (
      <List isLoading={false}>
        <EmptyTenantState />
      </List>
    );
  }

  // Render service dropdown if enough services
  const serviceDropdown =
    serviceOptions.length >= 2 ? (
      <List.Dropdown tooltip="Filter by Service" value={selectedService} onChange={handleServiceChange}>
        <List.Dropdown.Item title="All Services" value="all" />
        <List.Dropdown.Section title="Services">
          {serviceOptions.map((s) => (
            <List.Dropdown.Item key={s} title={s} value={s} />
          ))}
        </List.Dropdown.Section>
      </List.Dropdown>
    ) : tenant ? (
      <TenantSwitcher value={tenant.id} onChange={handleTenantChange} />
    ) : undefined;

  if (!isLoading && !error && allRecords.length === 0 && !isLoadingMore) {
    return (
      <List
        isLoading={false}
        searchBarPlaceholder="Search in log content (with 300ms debounce)..."
        searchBarAccessory={serviceDropdown}
        onSearchTextChange={setContentSearch}
      >
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No logs found"
          description={`Adjust filters or timeframe to find logs.`}
        />
      </List>
    );
  }

  if (error && !isLoading && allRecords.length === 0) {
    return (
      <List isLoading={false} searchBarAccessory={serviceDropdown}>
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
                  if (!tenant) return;
                  const timeRange = parseTimeframe(timeframe);
                  const logLevel = props.arguments.query ?? "error";
                  const dql = buildDqlQuery({
                    logLevel,
                    serviceName: selectedService !== "all" ? selectedService : undefined,
                    contentFilter: debouncedContent || undefined,
                  });
                  execute(dql, timeRange, tenant);
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading && allRecords.length === 0}
      searchBarPlaceholder="Search in log content (with 300ms debounce)..."
      searchBarAccessory={serviceDropdown}
      onSearchTextChange={setContentSearch}
    >
      {allRecords.map((log, index) => (
        <List.Item
          key={index}
          icon={getLogIcon(log.loglevel)}
          title={(log["service.name"] ?? log["dt.app.name"] ?? "Unknown Service") as string}
          subtitle={log.content}
          accessories={[
            {
              tag: {
                value: log.loglevel,
                color: log.loglevel === "ERROR" || log.loglevel === "FATAL" ? Color.Red : undefined,
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

      {/* Load more button */}
      {allRecords.length > 0 && !error && (
        <List.Item
          title={isLoadingMore ? "Loading more logs..." : "Load 50 more logs"}
          icon={isLoadingMore ? Icon.Clock : Icon.Plus}
          actions={
            <ActionPanel>
              <Action title={isLoadingMore ? "Loading…" : "Load More"} icon={Icon.Plus} onAction={handleLoadMore} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
