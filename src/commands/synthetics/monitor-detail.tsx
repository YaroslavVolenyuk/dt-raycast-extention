import { Action, ActionPanel, Detail, Icon, openInBrowser } from "@raycast/api";
import { useMemo, useEffect, useState } from "react";
import { SyntheticMonitorData, ExecutionStatus, LocationResult } from "../../lib/types/synthetic";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import { getActiveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";

interface MonitorDetailActionProps {
  monitor: SyntheticMonitorData;
}

/**
 * Action component that pushes to monitor detail view
 */
export function MonitorDetailAction({ monitor }: MonitorDetailActionProps) {
  return (
    <ActionPanel>
      <Action.Push title="View Details" target={<MonitorDetailView monitor={monitor} />} />
    </ActionPanel>
  );
}

/**
 * Monitor detail view showing status by location
 */
export function MonitorDetailView({ monitor }: { monitor: SyntheticMonitorData }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      const activeTenant = await getActiveTenant();
      setTenant(activeTenant);
    };
    loadTenant();
  }, []);

  const getLocationStatusIcon = (status: ExecutionStatus): string => {
    switch (status) {
      case ExecutionStatus.OK:
        return "🟢";
      case ExecutionStatus.FAILED:
        return "🔴";
      case ExecutionStatus.PARTIAL_FAILED:
        return "🟡";
      case ExecutionStatus.TIMEOUT:
        return "⏱️";
      default:
        return "⚪";
    }
  };

  const markdown = useMemo(() => {
    const m = monitor.monitor;
    const exec = monitor.lastExecution;

    let locationTable = "";
    if (exec?.locationResults && exec.locationResults.length > 0) {
      locationTable = `
## Results by Location

| Location | Status | Response Time | Error |
|----------|--------|---------------|-------|
${exec.locationResults.map((loc: LocationResult) => {
  const statusIcon = getLocationStatusIcon(loc.status);
  const responseTime = loc.responseTime ? `${loc.responseTime}ms` : "—";
  const error = loc.errorMessage ? `${loc.errorMessage}` : "—";
  return `| ${loc.location} | ${statusIcon} ${loc.status} | ${responseTime} | ${error} |`;
}).join("\n")}
`;
    }

    return `# ${m.name}

**Type:** ${m.type}
**Status:** ${m.enabled ? "🟢 Enabled" : "⚫ Disabled"}

## Health Metrics

- **Availability:** ${monitor.availability.toFixed(2)}%
- **Failed Executions:** ${monitor.failureCount}
- **Average Response Time:** ${monitor.avgResponseTime || "—"}ms
- **Last Execution:** ${exec ? new Date(exec.timestamp).toLocaleString() : "Never"}

## Configuration

- **URL:** \`${m.url}\`
- **Schedule:** Every ${m.schedule.interval} minutes
- **Locations:** ${m.locations.join(", ")}
- **Owner:** ${m.owner || "Unassigned"}

${locationTable}

## Details

- **Monitor ID:** \`${m.monitorId}\`
- **Created:** ${new Date(m.createdAt).toLocaleDateString()}
- **Modified:** ${new Date(m.modifiedAt).toLocaleDateString()}
${exec?.errorMessage ? `- **Last Error:** ${exec.errorMessage}` : ""}
`;
  }, [monitor]);

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Monitor ID" content={monitor.monitor.monitorId} />
          <Action.CopyToClipboard title="Copy URL" content={monitor.monitor.url} />
          {tenant && (
            <Action
              title="Open in Dynatrace"
              icon={Icon.Globe}
              onAction={() => {
                const url = buildDeepLink("synthetic", monitor.monitor.monitorId, tenant);
                openInBrowser(url);
              }}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
