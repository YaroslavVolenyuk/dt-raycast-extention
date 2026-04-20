import { List, ActionPanel, Action, Icon, LocalStorage, Color } from "@raycast/api";
import LogDetailView from "./log-detail";
import { useDynatraceQuery } from "../../lib/query";
import { parseTimeframe } from "../../lib/utils/parseTimeframe";
import { buildDqlQuery, LogLevel } from "../../lib/utils/buildDqlQuery";
import { LogRecord } from "../../lib/types/log";
import { getActiveTenant, setActiveTenant } from "../../lib/tenants";
import TenantSwitcher from "../../components/TenantSwitcher";
import EmptyTenantState from "../../components/EmptyTenantState";
import { useEffect, useState, useMemo } from "react";
import type { TenantConfig } from "../../lib/auth";

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

  // Persistent filter state — stored timeframe loaded from LocalStorage on mount
  const [storedTimeframe, setStoredTimeframe] = useState<string | null>(null);
  // Service/app filter
  const [selectedService, setSelectedService] = useState<string>("all");
  // Gate: don't fire query until LocalStorage + tenant are loaded
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  // Active tenant
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantChecked, setTenantChecked] = useState(false);

  // Effective timeframe: command arg wins → stored value → default "24h"
  const timeframe = timeframeValue
    ? `${timeframeValue}${timeframeUnit ?? "h"}`
    : (storedTimeframe ?? "24h");

  const { data, isLoading, error, execute } = useDynatraceQuery<LogRecord>();

  // Load persisted filters and active tenant once on mount
  useEffect(() => {
    Promise.all([
      LocalStorage.getItem<string>(KEY_TIMEFRAME),
      LocalStorage.getItem<string>(KEY_APP_FILTER),
      getActiveTenant(),
    ]).then(([tf, svc, activeTenant]) => {
      if (!timeframeValue && tf) setStoredTimeframe(tf);
      if (svc) setSelectedService(svc);
      setTenant(activeTenant);
      setTenantChecked(true);
      setFiltersLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally once

  // Execute query after persisted filters are loaded; re-run if args or tenant change
  useEffect(() => {
    if (!filtersLoaded || !tenant) return;
    const timeRange = parseTimeframe(timeframe);
    const dql = buildDqlQuery({ logLevel: effectiveLogLevel });
    execute(dql, timeRange, tenant);
    // Persist effective timeframe so next launch can restore it
    LocalStorage.setItem(KEY_TIMEFRAME, timeframe);
  }, [timeframe, effectiveLogLevel, filtersLoaded, tenant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update service selection and persist immediately
  const handleServiceChange = (value: string) => {
    setSelectedService(value);
    LocalStorage.setItem(KEY_APP_FILTER, value);
  };

  // Handle tenant switch from TenantSwitcher dropdown
  const handleTenantChange = async (id: string) => {
    await setActiveTenant(id);
    const all = await import("../../lib/tenants").then((m) => m.listTenants());
    const next = all.find((t) => t.id === id) ?? null;
    setTenant(next);
    // Rerun query will fire from useEffect dependency on tenant
  };

  const logs = data?.records ?? [];

  // Collect unique service / app names from current results for dropdown
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

  // Show empty tenant state if no tenant is configured
  if (tenantChecked && !tenant) {
    return (
      <List isLoading={false}>
        <EmptyTenantState />
      </List>
    );
  }

  // Show service dropdown when there are ≥2 unique services
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
    ) : (
      tenant ? (
        <TenantSwitcher value={tenant.id} onChange={handleTenantChange} />
      ) : undefined
    );

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
                  if (!tenant) return;
                  const timeRange = parseTimeframe(timeframe);
                  const dql = buildDqlQuery({ logLevel: effectiveLogLevel });
                  execute(dql, timeRange, tenant);
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
    </List>
  );
}
