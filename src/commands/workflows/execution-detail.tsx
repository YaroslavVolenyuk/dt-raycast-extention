// Execution detail view — shows only data actually returned by the Automation API.
// Task-level breakdown, cancel and re-run are intentionally not implemented:
// their endpoints have not been contract-verified against a live tenant.
import { Detail, Action, ActionPanel, Icon, useNavigation } from "@raycast/api";
import type { WorkflowExecution } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { buildDeepLink } from "../../lib/utils/deepLinks";

interface ExecutionDetailViewProps {
  execution: WorkflowExecution;
  workflowName: string;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function ExecutionDetailView({ execution, workflowName, tenant, onRefresh }: ExecutionDetailViewProps) {
  const { pop } = useNavigation();

  const markdown = buildExecutionDetail(execution, workflowName);

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Execution ID" content={execution.id} />
          {tenant && (
            <Action.OpenInBrowser
              title="Open Workflow in Dynatrace"
              icon={Icon.Globe}
              url={buildDeepLink("workflow", execution.workflowId, tenant)}
            />
          )}
          <Action title="Refresh" icon={Icon.RotateClockwise} onAction={onRefresh} />
          <Action title="Back" icon={Icon.ChevronLeft} onAction={pop} />
        </ActionPanel>
      }
    />
  );
}

function buildExecutionDetail(execution: WorkflowExecution, workflowName: string): string {
  let md = `# Execution Details\n\n`;
  md += `**Workflow:** ${workflowName}\n`;
  md += `**Execution ID:** \`${execution.id}\`\n\n`;

  const statusEmoji = getStatusEmoji(execution.status);
  md += `## ${statusEmoji} ${execution.status}\n\n`;

  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **Started** | ${formatDateTime(execution.startTime)} |\n`;

  if (execution.endTime) {
    md += `| **Ended** | ${formatDateTime(execution.endTime)} |\n`;
  }

  if (execution.durationMs) {
    md += `| **Duration** | ${formatDuration(execution.durationMs)} |\n`;
  }

  if (execution.triggeredBy) {
    md += `| **Triggered By** | ${execution.triggeredBy} |\n`;
  }

  md += `\n`;
  md += `_Task-level breakdown is available in the Dynatrace Workflows UI (use "Open Workflow in Dynatrace")._\n`;

  return md;
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "SUCCEEDED":
      return "✓";
    case "FAILED":
      return "✗";
    case "RUNNING":
      return "◆";
    case "PAUSED":
      return "⏸";
    case "CANCELLED":
      return "⊘";
    case "SKIPPED":
      return "—";
    default:
      return "•";
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  return `${seconds}s`;
}
