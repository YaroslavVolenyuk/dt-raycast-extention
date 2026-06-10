// src/components/EmptyTenantState.tsx
// Shown when no tenants are configured — prompts the user to add one.

import { List, ActionPanel, Action, Icon, launchCommand, LaunchType, showToast, Toast } from "@raycast/api";

export default function EmptyTenantState() {
  return (
    <List.EmptyView
      icon={Icon.Globe}
      title="No tenant configured"
      description="Add a Dynatrace tenant to start querying logs, problems and more."
      actions={
        <ActionPanel>
          <Action
            title="Open Manage Tenants"
            icon={Icon.Gear}
            onAction={async () => {
              try {
                await launchCommand({ name: "dt-tenants", type: LaunchType.UserInitiated });
              } catch {
                await showToast({ style: Toast.Style.Failure, title: "Cannot open Manage Tenants" });
              }
            }}
          />
        </ActionPanel>
      }
    />
  );
}
