// SLO Detail View — shows full SLO details and actions
import { Detail, Action, ActionPanel, Icon, showToast, Toast, Clipboard, useNavigation } from "@raycast/api";
import { useState } from "react";
import { getActiveTenant } from "../../lib/tenants";
import { dynatraceRest } from "../../lib/api/rest";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import type { SLO } from "../../lib/types/slo";

interface SloDetailViewProps {
  slo: SLO;
  onRefresh: () => Promise<void>;
}

export default function SloDetailView({ slo, onRefresh }: SloDetailViewProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { pop } = useNavigation();

  const handleEvaluateNow = async () => {
    try {
      setIsEvaluating(true);
      const tenant = await getActiveTenant();
      if (!tenant) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "No active tenant configured",
        });
        return;
      }

      await dynatraceRest(tenant, `/api/v2/slo/${encodeURIComponent(slo.id)}/evaluate`, {
        method: "POST",
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: "SLO evaluation triggered",
      });

      // Refresh the list
      await onRefresh();
      pop();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to evaluate SLO";
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message,
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleOpenInDynatrace = async () => {
    try {
      const tenant = await getActiveTenant();
      if (!tenant) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "No active tenant configured",
        });
        return;
      }

      const url = buildDeepLink("slo", slo.id, tenant);
      // In Raycast, we'd open the URL using open() from @raycast/api
      await showToast({
        style: Toast.Style.Success,
        title: "Deep Link Ready",
        message: url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate deep link";
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message,
      });
    }
  };

  const handleCopyId = async () => {
    try {
      await Clipboard.copy(slo.id);
      await showToast({
        style: Toast.Style.Success,
        title: "Copied",
        message: "SLO ID copied to clipboard",
      });
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Copy failed",
      });
    }
  };

  const statusColor = slo.compliance >= slo.target ? "🟢" : slo.compliance >= slo.warning ? "🟡" : "🔴";
  const statusText =
    slo.compliance >= slo.target
      ? "Healthy (Target Met)"
      : slo.compliance >= slo.warning
        ? "Warning (Below Target)"
        : "Critical (Below Warning)";

  const markdown = `# ${slo.name}

## Status ${statusColor}

${statusText}

---

## Key Metrics

- **Current Compliance:** ${slo.compliance.toFixed(2)}%
- **Target Compliance:** ${slo.target.toFixed(2)}%
- **Warning Threshold:** ${slo.warning.toFixed(2)}%
${slo.errorBudgetRemaining !== null && slo.errorBudgetRemaining !== undefined ? `- **Error Budget Remaining:** ${slo.errorBudgetRemaining.toFixed(2)}%` : ""}

---

## Configuration

- **ID:** \`${slo.id}\`
- **Timeframe:** ${slo.timeframe}
- **Status:** ${slo.enabled ? "Enabled" : "Disabled"}
${slo.evaluatedAt ? `- **Last Evaluated:** ${new Date(slo.evaluatedAt).toLocaleString()}` : ""}

${slo.description ? `---\n\n## Description\n\n${slo.description}` : ""}

${slo.metricDefinition ? `---\n\n## Metric Definition\n\n\`\`\`dql\n${slo.metricDefinition}\n\`\`\`` : ""}`;

  return (
    <Detail
      navigationTitle={slo.name}
      markdown={markdown}
      isLoading={isEvaluating}
      actions={
        <ActionPanel>
          <Action title="Evaluate Now" icon={Icon.RotateClockwise} onAction={handleEvaluateNow} />
          <Action title="Open in Dynatrace" icon={Icon.Link} onAction={handleOpenInDynatrace} />
          <Action title="Copy SLO ID" icon={Icon.Clipboard} onAction={handleCopyId} />
          <Action title="Back" icon={Icon.ArrowLeft} onAction={() => pop()} />
        </ActionPanel>
      }
    />
  );
}
