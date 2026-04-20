import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
} from "@raycast/api";
import { useEffect, useState, useMemo } from "react";
import { useDynatraceQuery } from "../../lib/query";
import { Deployment, buildDeploymentsQuery } from "../../lib/types/deployment";
import { getActiveTenant, setActiveTenant } from "../../lib/tenants";
import TenantSwitcher from "../../components/TenantSwitcher";
import EmptyTenantState from "../../components/EmptyTenantState";
import type { TenantConfig } from "../../lib/auth";
import DeploymentDetailView from "./deployment-detail";

function formatTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function DeploymentsCommand() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantChecked, setTenantChecked] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const { data, isLoading, error, execute } = useDynatraceQuery<Deployment>();

  // Load active tenant once on mount
  useEffect(() => {
    getActiveTenant().then((activeTenant) => {
      setTenant(activeTenant);
      setTenantChecked(true);
      setFiltersLoaded(true);
    });
  }, []);

  // Execute query when filters are loaded
  useEffect(() => {
    if (!filtersLoaded || !tenant) return;

    const dql = buildDeploymentsQuery();
    execute(dql, undefined, tenant);
  }, [filtersLoaded, tenant, execute]);

  const handleTenantChange = async (id: string) => {
    await setActiveTenant(id);
    const all = await import("../../lib/tenants").then((m) => m.listTenants());
    const next = all.find((t) => t.id === id) ?? null;
    setTenant(next);
  };

  const deployments = data?.records ?? [];

  if (tenantChecked && !tenant) {
    return (
      <List isLoading={false}>
        <EmptyTenantState />
      </List>
    );
  }

  if (!isLoading && !error && deployments.length === 0) {
    return (
      <List
        isLoading={false}
        searchBarAccessory={
          tenant ? <TenantSwitcher value={tenant.id} onChange={handleTenantChange} /> : undefined
        }
      >
        <List.EmptyView icon={Icon.Upload} title="No recent deployments" description="Check back later" />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarAccessory={
        tenant ? <TenantSwitcher value={tenant.id} onChange={handleTenantChange} /> : undefined
      }
    >
      {deployments.map((deployment) => (
        <List.Item
          key={deployment["event.id"]}
          icon={Icon.Upload}
          title={deployment["event.name"]}
          subtitle={`${deployment.affected_entity_name || "Unknown"} · v${deployment["deployment.version"] || "?"}`}
          accessories={[
            {
              tag: {
                value: deployment["deployment.release_stage"] || "unknown",
                color: deployment["deployment.release_stage"] === "canary" ? Color.Yellow : Color.Green,
              },
            },
            {
              text: deployment["event.provider"] || "unknown",
            },
            {
              text: formatTimeAgo(deployment["event.start"]),
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="Show Details" target={<DeploymentDetailView deployment={deployment} tenant={tenant!} />} />
              <Action.CopyToClipboard content={deployment["event.id"]} title="Copy Deployment ID" />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
