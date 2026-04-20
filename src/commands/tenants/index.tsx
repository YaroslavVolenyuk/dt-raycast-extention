// src/commands/tenants/index.tsx
// Manage Tenants command — list, add, edit and delete Dynatrace tenant configs.

import { List, ActionPanel, Action, Icon, Alert, confirmAlert, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { listTenants, deleteTenant, setActiveTenant, getActiveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";
import TenantForm from "./tenant-form";

export default function Command() {
  const { push } = useNavigation();
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function reload() {
    setIsLoading(true);
    const [all, active] = await Promise.all([listTenants(), getActiveTenant()]);
    setTenants(all);
    setActiveTenantId(active?.id ?? null);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSetActive(tenant: TenantConfig) {
    await setActiveTenant(tenant.id);
    setActiveTenantId(tenant.id);
    await showToast({ style: Toast.Style.Success, title: `Active tenant: ${tenant.name}` });
  }

  async function handleDelete(tenant: TenantConfig) {
    const confirmed = await confirmAlert({
      title: `Delete "${tenant.name}"?`,
      message: "This action cannot be undone.",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    await deleteTenant(tenant.id);
    await showToast({ style: Toast.Style.Success, title: `Deleted "${tenant.name}"` });
    reload();
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Manage Tenants"
      actions={
        <ActionPanel>
          <Action title="Add Tenant" icon={Icon.Plus} onAction={() => push(<TenantForm onSave={reload} />)} />
        </ActionPanel>
      }
    >
      {tenants.length === 0 && !isLoading && (
        <List.EmptyView
          icon={Icon.Globe}
          title="No tenants configured"
          description="Press ↵ to add your first Dynatrace tenant."
          actions={
            <ActionPanel>
              <Action title="Add Tenant" icon={Icon.Plus} onAction={() => push(<TenantForm onSave={reload} />)} />
            </ActionPanel>
          }
        />
      )}
      {tenants.map((tenant) => {
        const isActive = tenant.id === activeTenantId;
        return (
          <List.Item
            key={tenant.id}
            icon={isActive ? { source: Icon.Checkmark } : { source: Icon.Globe }}
            title={tenant.name}
            subtitle={tenant.tenantEndpoint}
            accessories={isActive ? [{ icon: Icon.Checkmark, tooltip: "Active" }] : []}
            actions={
              <ActionPanel>
                {!isActive && (
                  <Action title="Set as Active" icon={Icon.Checkmark} onAction={() => handleSetActive(tenant)} />
                )}
                <Action
                  title="Edit"
                  icon={Icon.Pencil}
                  onAction={() => push(<TenantForm existing={tenant} onSave={reload} />)}
                />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => handleDelete(tenant)}
                />
                <ActionPanel.Section>
                  <Action title="Add Tenant" icon={Icon.Plus} onAction={() => push(<TenantForm onSave={reload} />)} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
