// B3-2: Settings detail view with JSON definition and copy actions
import { Detail, Action, ActionPanel, Icon, showToast, Toast, useNavigation, Clipboard, open } from "@raycast/api";
import type { SettingsObject } from "../../lib/types/settings";
import type { TenantConfig } from "../../lib/auth";
import { getSettingsTypeIcon, getSettingsTypeLabel } from "../../lib/types/settings";

interface SettingDetailViewProps {
  setting: SettingsObject;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function SettingDetailView({ setting, tenant, onRefresh }: SettingDetailViewProps) {
  const { pop } = useNavigation();

  const markdown = buildSettingDetail(setting);

  const handleCopyJSON = async () => {
    try {
      const jsonStr = JSON.stringify(setting.value, null, 2);
      await Clipboard.copy(jsonStr);
      await showToast({
        style: Toast.Style.Success,
        title: "JSON Copied",
        message: "Configuration JSON copied to clipboard",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Copy Failed",
        message: msg,
      });
    }
  };

  const handleCopyID = async () => {
    try {
      await Clipboard.copy(setting.objectId);
      await showToast({
        style: Toast.Style.Success,
        title: "ID Copied",
        message: `Object ID copied: ${setting.objectId}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Copy Failed",
        message: msg,
      });
    }
  };

  const handleOpenInDynatrace = async () => {
    if (tenant) {
      const deepLinkUrl = `${tenant.tenantEndpoint}/ui/apps/dynatrace.settings/configuration/schema/${setting.schemaId}/objects/${setting.objectId}`;
      await open(deepLinkUrl);
    }
  };

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Copy JSON" icon={Icon.Clipboard} onAction={handleCopyJSON} />
          <Action title="Copy Object ID" icon={Icon.Clipboard} onAction={handleCopyID} />
          <Action title="Open in Dynatrace" icon={Icon.Globe} onAction={handleOpenInDynatrace} />
          <Action title="Refresh" icon={Icon.RotateClockwise} onAction={onRefresh} />
          <Action title="Back" icon={Icon.ChevronLeft} onAction={pop} />
        </ActionPanel>
      }
    />
  );
}

function buildSettingDetail(setting: SettingsObject): string {
  let md = `# ${getSettingsTypeIcon(setting.schemaId)} ${setting.displayName}\n\n`;

  // Description
  if (setting.description) {
    md += `${setting.description}\n\n`;
  }

  // Metadata
  md += `## Configuration\n\n`;
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **Type** | ${getSettingsTypeLabel(setting.schemaId)} |\n`;
  md += `| **Schema ID** | \`${setting.schemaId}\` |\n`;
  md += `| **Object ID** | \`${setting.objectId}\` |\n`;

  if (setting.scope) {
    md += `| **Scope** | ${setting.scope} |\n`;
  }

  if (setting.author) {
    md += `| **Author** | ${setting.author} |\n`;
  }

  if (setting.createdAt) {
    md += `| **Created** | ${formatDate(setting.createdAt)} |\n`;
  }

  if (setting.modifiedAt) {
    md += `| **Modified** | ${formatDate(setting.modifiedAt)} |\n`;
  }

  md += `| **Modified** | ${setting.isModified ? "Yes" : "No"} |\n`;
  md += `\n`;

  // JSON Definition
  md += `## JSON Definition\n\n`;
  md += `\`\`\`json\n`;
  md += `${JSON.stringify(setting.value, null, 2)}\n`;
  md += `\`\`\`\n\n`;

  // Schema info
  md += `## Schema Information\n\n`;
  md += `- **Schema Version:** ${setting.schemaVersion || "Unknown"}\n`;
  md += `- **Object Count:** 1 (this object)\n`;
  md += `\n`;

  // Tips
  md += `## Tips\n\n`;
  md += `- Use "Copy JSON" action to export this configuration\n`;
  md += `- Use "Copy Object ID" to get the unique identifier\n`;
  md += `- Open in Dynatrace to edit in the web UI\n`;

  return md;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
}
