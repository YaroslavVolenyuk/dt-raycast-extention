// src/commands/problems/index.instrumented.tsx
// Example of integrating instrumentation into the problems view
// This shows how to add tracing and logging to existing components

import { List, ActionPanel, Action, Icon, Color, Clipboard, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { useDynatraceQuery } from "../../lib/query";
import { Problem, buildProblemsQuery } from "../../lib/types/problem";
import { getActiveTenant, setActiveTenant, listTenants } from "../../lib/tenants";
import TenantSwitcher from "../../components/TenantSwitcher";
import EmptyTenantState from "../../components/EmptyTenantState";
import { getActiveTenantOrMock } from "../../lib/mockTenant";
import type { TenantConfig } from "../../lib/auth";
import ProblemDetailView from "./problem-detail";
import { toJson, toCsv } from "../../lib/utils/exportData";

// INSTRUMENTATION IMPORTS
import { logger } from "../../lib/instrumentation";
import { useTracing } from "../../lib/instrumentation/useTracing";
import { traceQueryExecution } from "../../lib/instrumentation/queryTracing";

const SEVERITY_ICONS: Record<string, Icon> = {
  AVAILABILITY: Icon.XMarkCircle,
  ERROR: Icon.Xmark,
  PERFORMANCE: Icon.Gauge,
  RESOURCE_CONTENTION: Icon.HardDrive,
  CUSTOM_ALERT: Icon.Bell,
};

const SEVERITY_COLORS: Record<string, Color> = {
  AVAILABILITY: Color.Red,
  ERROR: Color.Orange,
  PERFORMANCE: Color.Yellow,
  RESOURCE_CONTENTION: Color.Blue,
  CUSTOM_ALERT: Color.Purple,
};

function getIcon(severity: string): Icon {
  return SEVERITY_ICONS[severity] ?? Icon.Circle;
}

function getColor(severity: string): Color {
  return SEVERITY_COLORS[severity] ?? Color.SecondaryText;
}

function formatDuration(startTime: string, endTime?: string | null): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const durationMs = end - start;

  const durationMin = Math.floor(durationMs / 60_000);
  if (durationMin < 60) return `${durationMin} min`;

  const durationH = Math.floor(durationMin / 60);
  if (durationH < 24) return `${durationH} hours`;

  return `${Math.floor(durationH / 24)} days`;
}

function formatTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export default function ProblemsCommand() {
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantChecked, setTenantChecked] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [allTenants, setAllTenants] = useState<TenantConfig[]>([]);

  // INSTRUMENTATION SETUP
  const { traceAsync, log } = useTracing({
    commandName: "dt-problems",
    attributes: {
      view: "problems-list",
    },
  });

  const { data, isLoading, error, execute } = useDynatraceQuery<Problem>();

  // Load active tenant and all tenants once on mount
  useEffect(() => {
    log("debug", "Problems view loaded");

    Promise.all([getActiveTenantOrMock(() => getActiveTenant()), listTenants()])
      .then(([activeTenant, tenants]) => {
        setTenant(activeTenant);
        setAllTenants(tenants);
        setTenantChecked(true);
        setFiltersLoaded(true);

        // Log successful tenant load
        log("info", "Tenants loaded", {
          tenantCount: tenants.length,
          activeTenant: activeTenant?.id,
        });
      })
      .catch((err) => {
        logger.error("Failed to load tenants", err as Error);
      });
  }, [log]);

  // Execute query when filters are loaded
  useEffect(() => {
    if (!filtersLoaded || !tenant) return;

    // TRACE DQL QUERY EXECUTION
    traceAsync("execute_problems_query", async () => {
      const dql = buildProblemsQuery(statusFilter);

      return traceQueryExecution(
        "problems_query",
        async () => {
          log("debug", "Executing problems query", {
            statusFilter,
            tenantId: tenant.id,
            query: dql.substring(0, 100),
          });

          return execute(dql, undefined, tenant);
        },
        {
          query: dql,
          queryType: "davis_problems",
          tenant: tenant.id,
        },
      );
    }).catch((err) => {
      logger.error("Problems query failed", err as Error);
    });
  }, [statusFilter, filtersLoaded, tenant, execute, traceAsync, log]);

  const handleTenantChange = async (id: string) => {
    await traceAsync("switch_tenant", async () => {
      log("info", "Switching tenant", { fromTenant: tenant?.id, toTenant: id });

      await setActiveTenant(id);
      const all = await import("../../lib/tenants").then((m) => m.listTenants());
      const next = all.find((t) => t.id === id) ?? null;
      setTenant(next);

      log("info", "Tenant switched", { newTenant: next?.id });
    });
  };

  const handleExportJson = async () => {
    await traceAsync("export_problems_json", async () => {
      try {
        const problems = data?.records ?? [];
        const json = toJson(problems);
        await Clipboard.copy(json);

        log("info", "Problems exported to JSON", { count: problems.length });

        await showToast({
          style: Toast.Style.Success,
          title: "Exported",
          message: `${problems.length} problems exported to clipboard as JSON`,
        });
      } catch (error) {
        logger.error("Export to JSON failed", error as Error);

        await showToast({
          style: Toast.Style.Failure,
          title: "Export failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleExportCsv = async () => {
    await traceAsync("export_problems_csv", async () => {
      try {
        const problems = data?.records ?? [];
        const csv = toCsv(
          problems.map((p) => ({
            id: p["event.id"],
            name: p["event.name"],
            severity: p["event.severity"],
            status: p["event.status"],
            start: p["event.start"],
            entities: p.affected_entity_ids?.join("; ") || "",
            duration: formatDuration(p["event.start"], p["event.end"]),
          })),
        );
        await Clipboard.copy(csv);

        log("info", "Problems exported to CSV", { count: problems.length });

        await showToast({
          style: Toast.Style.Success,
          title: "Exported",
          message: `${problems.length} problems exported to clipboard as CSV`,
        });
      } catch (error) {
        logger.error("Export to CSV failed", error as Error);

        await showToast({
          style: Toast.Style.Failure,
          title: "Export failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const problems = data?.records ?? [];

  if (tenantChecked && !tenant) {
    return (
      <List isLoading={false}>
        <EmptyTenantState />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      filtering={{ keepSectionOrder: true }}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Show"
          value={statusFilter}
          onChange={(newValue) => {
            const filter = newValue as "OPEN" | "ALL";
            setStatusFilter(filter);
            log("info", "Filter changed", { newFilter: filter });
          }}
        >
          <List.Dropdown.Item title="Open Problems" value="OPEN" />
          <List.Dropdown.Item title="All Problems" value="ALL" />
        </List.Dropdown>
      }
    >
      {problems.map((problem) => (
        <List.Item
          key={problem["event.id"]}
          icon={{ source: Icon.Circle, tintColor: getColor(problem["event.severity"]) }}
          title={problem["event.name"]}
          subtitle={`${problem["event.severity"]} • ${formatTimeAgo(problem["event.start"])} ago`}
          accessories={[
            {
              tag: { value: problem["event.status"], color: problem["event.status"] === "OPEN" ? Color.Red : Color.Green },
            },
            {
              text: formatDuration(problem["event.start"], problem["event.end"]),
              tooltip: `Started: ${problem["event.start"]}${problem["event.end"] ? `\nEnded: ${problem["event.end"]}` : ""}`,
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Details"
                target={<ProblemDetailView problem={problem} />}
                onPush={() => {
                  log("debug", "Opening problem details", { problemId: problem["event.id"] });
                }}
              />
              <Action.CopyToClipboard
                title="Copy Problem ID"
                content={problem["event.id"]}
                onCopy={() => {
                  log("debug", "Copied problem ID", { problemId: problem["event.id"] });
                }}
              />
              <Action
                title="Export as JSON"
                icon={Icon.Download}
                onAction={handleExportJson}
              />
              <Action
                title="Export as CSV"
                icon={Icon.Download}
                onAction={handleExportCsv}
              />
              <Action.Push
                title="Switch Tenant"
                target={<TenantSwitcher allTenants={allTenants} onSelect={handleTenantChange} />}
              />
            </ActionPanel>
          }
        />
      ))}

      {!isLoading && problems.length === 0 && (
        <List.EmptyView
          icon={Icon.Checkmark}
          title={statusFilter === "OPEN" ? "No Open Problems!" : "No Problems"}
          description={statusFilter === "OPEN" ? "Your environment is healthy 🎉" : "No problems to display"}
        />
      )}

      {error && (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Error Loading Problems"
          description={error}
        />
      )}
    </List>
  );
}
