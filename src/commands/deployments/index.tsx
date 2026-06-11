import { List, ActionPanel, Action, Icon, Color } from "@raycast/api";
import { useEffect } from "react";
import { useDynatraceQuery } from "../../lib/query";
import { Deployment, buildDeploymentsQuery } from "../../lib/types/deployment";
import { setActiveTenant } from "../../lib/tenants";
import EmptyTenantState from "../../components/EmptyTenantState";
import { useActiveTenant } from "../../lib/hooks/useActiveTenant";
import DeploymentDetailView from "./deployment-detail";

function formatTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export default function DeploymentsCommand() {
  const { tenant, tenants: allTenants, isLoading: tenantLoading } = useActiveTenant();
  const tenantChecked = !tenantLoading;

  const { data, isLoading, error, execute } = useDynatraceQuery<Deployment>();

  // Execute query when tenant is loaded
  useEffect(() => {
    if (tenantLoading || !tenant) return;

    const dql = buildDeploymentsQuery();
    execute(dql, undefined, tenant);
  }, [tenantLoading, tenant, execute]);

  const handleTenantChange = async (id: string) => {
    await setActiveTenant(id);
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
        actions={
          allTenants.length > 0 ? (
            <ActionPanel>
              <ActionPanel.Section title="Switch Tenant">
                {allTenants.map((t) => (
                  <Action
                    key={t.id}
                    title={t.name}
                    icon={tenant?.id === t.id ? Icon.CheckCircle : Icon.Circle}
                    onAction={() => handleTenantChange(t.id)}
                  />
                ))}
              </ActionPanel.Section>
            </ActionPanel>
          ) : undefined
        }
      >
        <List.EmptyView icon={Icon.Upload} title="No recent deployments" description="Check back later" />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      actions={
        allTenants.length > 0 ? (
          <ActionPanel>
            <ActionPanel.Section title="Switch Tenant">
              {allTenants.map((t) => (
                <Action
                  key={t.id}
                  title={t.name}
                  icon={tenant?.id === t.id ? Icon.CheckCircle : Icon.Circle}
                  onAction={() => handleTenantChange(t.id)}
                />
              ))}
            </ActionPanel.Section>
          </ActionPanel>
        ) : undefined
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
              icon: Icon.Clock,
              text: formatTimeAgo(deployment["event.start"]),
            },
            {
              text: deployment["event.provider"] || "unknown",
            },
            {
              tag: {
                value: deployment["deployment.release_stage"] || "unknown",
                color: deployment["deployment.release_stage"] === "canary" ? Color.Yellow : Color.Green,
              },
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Details"
                target={<DeploymentDetailView deployment={deployment} tenant={tenant!} />}
              />
              <Action.CopyToClipboard content={deployment["event.id"]} title="Copy Deployment ID" />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
