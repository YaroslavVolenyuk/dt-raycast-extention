import React from "react";
import {
  Detail,
  Action,
  ActionPanel,
  showToast,
  Toast,
  useNavigation,
  Icon,
  Keyboard,
  Clipboard,
  Alert,
  confirmAlert,
} from "@raycast/api";
import {
  MaintenanceWindow,
  getMaintenanceStatus,
  formatMaintenanceTime,
  getScopeDisplay,
  getSuppressionDisplay,
} from "../../lib/types/maintenance";
import { deleteMaintenanceWindow } from "../../lib/api/maintenance";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import { useTenant } from "../../hooks/useTenant";

interface MaintenanceDetailProps {
  window: MaintenanceWindow;
  onDeleted: () => void;
}

export default function MaintenanceDetail({ window, onDeleted }: MaintenanceDetailProps) {
  const { pop } = useNavigation();
  const { tenant } = useTenant();
  const status = getMaintenanceStatus(window);

  const duration =
    window.startTime != null && window.endTime != null
      ? `${Math.round((window.endTime - window.startTime) / 60000)} minutes`
      : "—";

  const markdown = `
# ${window.name}

**Type:** ${window.maintenanceType}
**Schedule:** ${window.scheduleType}
**Status:** ${status}

## Schedule

- **Start:** ${formatMaintenanceTime(window.startTime)}
- **End:** ${formatMaintenanceTime(window.endTime)}
- **Duration:** ${duration}
${window.timeZone ? `- **Time Zone:** ${window.timeZone}` : ""}

## Scope

${getScopeDisplay(window.filters)}

## Settings

- **Suppression:** ${getSuppressionDisplay(window.suppression)}
- **Synthetic Execution Disabled:** ${window.disableSyntheticMonitorExecution ? "✅ Yes" : "❌ No"}
- **Enabled:** ${window.enabled ? "✅ Yes" : "❌ No"}

${window.description ? `\n## Description\n\n${window.description}` : ""}
`;

  const handleDelete = async () => {
    if (!tenant) {
      await showToast({ style: Toast.Style.Failure, title: "No tenant configured" });
      return;
    }
    const confirmed = await confirmAlert({
      title: `Delete "${window.name}"?`,
      message: "The maintenance window will be permanently removed from Dynatrace.",
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      await deleteMaintenanceWindow(tenant, window.id);
      await showToast({ style: Toast.Style.Success, title: "Deleted", message: `"${window.name}" has been deleted` });
      onDeleted();
      pop();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleCopyId = async () => {
    try {
      await Clipboard.copy(window.id);
      await showToast({ style: Toast.Style.Success, title: "Copied", message: "Window ID copied to clipboard" });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to copy",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Copy Window ID"
            onAction={handleCopyId}
            icon={Icon.Clipboard}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          {tenant && (
            <Action.OpenInBrowser
              url={buildDeepLink("maintenance-window", window.id, tenant)}
              icon={Icon.Globe}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
          )}
          <Action
            title="Delete"
            onAction={handleDelete}
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
          />
        </ActionPanel>
      }
    />
  );
}
