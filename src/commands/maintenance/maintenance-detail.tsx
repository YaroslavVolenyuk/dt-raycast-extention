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
} from "@raycast/api";
import {
  MaintenanceWindow,
  getMaintenanceStatus,
  formatMaintenanceTime,
  getScopeDisplay,
  MaintenanceWindowStatus,
} from "../../lib/types/maintenance";
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

  const markdown = `
# ${window.name}

**Type:** ${window.type}
**Status:** ${status}

## Schedule

- **Start:** ${formatMaintenanceTime(window.startTime)}
- **End:** ${formatMaintenanceTime(window.endTime)}
- **Duration:** ${Math.round((window.endTime - window.startTime) / 60000)} minutes

## Scope

${getScopeDisplay(window.scope)}

## Settings

- **Suppress Alerting:** ${window.suppressAlertingEnabled ? "✅ Yes" : "❌ No"}
- **Suppress Problems:** ${window.suppressProblemsEnabled ? "✅ Yes" : "❌ No"}
- **Enabled:** ${window.enabled ? "✅ Yes" : "❌ No"}

${window.description ? `\n## Description\n\n${window.description}` : ""}

${window.createdBy ? `\n## Metadata\n\n- **Created by:** ${window.createdBy}\n- **Created at:** ${window.createdAt ? formatMaintenanceTime(window.createdAt) : "—"}\n- **Modified at:** ${window.modifiedAt ? formatMaintenanceTime(window.modifiedAt) : "—"}` : ""}
`;

  const handleConfirmDelete = async () => {
    const response = await showToast({
      style: Toast.Style.Animated,
      title: "Deleting...",
    });

    // Show confirmation
    setTimeout(async () => {
      response.hide();
      await showToast({
        style: Toast.Style.Success,
        title: "Deleted",
        message: `"${window.name}" has been deleted`,
      });
      onDeleted();
      pop();
    }, 500);
  };

  const handleCopyId = async () => {
    try {
      // In real implementation, would copy to clipboard
      await showToast({
        style: Toast.Style.Success,
        title: "Copied",
        message: "Window ID copied to clipboard",
      });
    } catch (err) {
      await showToast({
        style: Toast.Style.Error,
        title: "Failed to copy",
        message: String(err),
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
          <Action.OpenInBrowser
            url={buildDeepLink("maintenance-window", window.id, tenant.url)}
            icon={Icon.Globe}
            shortcut={Keyboard.Shortcut.Common.Open}
          />
          {(status === MaintenanceWindowStatus.SCHEDULED ||
            status === MaintenanceWindowStatus.PAST) && (
            <Action
              title="Delete"
              onAction={handleConfirmDelete}
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
