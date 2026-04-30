// B1-2: Workflow detail view with execution history
import { Detail, Action, ActionPanel, Icon, useNavigation } from "@raycast/api";
import type { Workflow, WorkflowExecution } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { MOCK_WORKFLOW_EXECUTIONS } from "../../lib/api/mock";
import ExecuteWorkflowForm from "./execute-workflow";
import ExecutionsList from "./executions-list";

interface WorkflowDetailViewProps {
  workflow: Workflow;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function WorkflowDetailView({ workflow, tenant, onRefresh }: WorkflowDetailViewProps) {
  const { push } = useNavigation();

  // Mock execution history - in real app, would fetch from API
  const executionHistory: WorkflowExecution[] = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.workflowId === workflow.id);

  // Build markdown detail view
  const markdown = buildWorkflowDetail(workflow, executionHistory);

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Execute Workflow"
            icon={Icon.Play}
            onAction={() => {
              if (workflow.inputParametersSchema && Object.keys(workflow.inputParametersSchema).length > 0) {
                // Has parameters - show form
                push(
                  <ExecuteWorkflowForm
                    workflow={workflow}
                    tenant={tenant}
                    onSuccess={() => {
                      onRefresh();
                    }}
                  />,
                );
              } else {
                // No parameters - execute directly
                handleExecuteWorkflow(workflow, null);
              }
            }}
          />
          <Action
            title="View Execution History"
            icon={Icon.Clock}
            onAction={() => {
              push(
                <ExecutionsList
                  workflowId={workflow.id}
                  workflowName={workflow.name}
                  tenant={tenant}
                  onRefresh={onRefresh}
                />,
              );
            }}
          />
          <Action
            title="Open in Dynatrace"
            icon={Icon.Globe}
            onAction={() => {
              if (tenant) {
                // In real app, use openInBrowser with:
                // `${tenant.url}/ui/apps/dynatrace.workflows/workflow/${workflow.id}`
              }
            }}
          />
          <Action
            title="Refresh"
            icon={Icon.RotateClockwise}
            onAction={onRefresh}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </ActionPanel>
      }
    />
  );
}

function buildWorkflowDetail(workflow: Workflow, executionHistory: WorkflowExecution[]): string {
  let md = `# ${workflow.name}\n\n`;

  // Description
  if (workflow.description) {
    md += `${workflow.description}\n\n`;
  }

  // Basic info
  md += `## Configuration\n\n`;
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **ID** | \`${workflow.id}\` |\n`;
  md += `| **Owner** | ${workflow.owner || "Unknown"} |\n`;
  md += `| **Status** | ${workflow.enabled ? "🟢 Enabled" : "⚫ Disabled"} |\n`;
  md += `| **Trigger Type** | ${getTriggerTypeLabel(workflow.triggerType)} |\n`;
  md += `| **Created** | ${formatDate(workflow.createdAt)} |\n`;
  md += `| **Modified** | ${formatDate(workflow.modifiedAt)} |\n\n`;

  // Trigger configuration
  if (workflow.triggerType === "SCHEDULE") {
    md += `### Schedule Configuration\n`;
    md += `Runs on a fixed schedule. Configure timing in Dynatrace UI.\n\n`;
  } else if (workflow.triggerType === "EVENT") {
    md += `### Event Trigger\n`;
    md += `Triggered by platform events (incidents, deployments, etc.)\n\n`;
  } else {
    md += `### Manual Trigger\n`;
    md += `Triggered manually by users via API or UI.\n\n`;
  }

  // Input parameters schema
  if (workflow.inputParametersSchema && Object.keys(workflow.inputParametersSchema).length > 0) {
    md += `## Input Parameters\n\n`;
    const schema = workflow.inputParametersSchema as {
      properties?: Record<string, { type?: string; description?: string }>;
      required?: string[];
    };
    const props = schema.properties || {};
    const required = schema.required || [];

    for (const [key, prop] of Object.entries(props)) {
      const isRequired = required.includes(key) ? "**required**" : "optional";
      md += `- **${key}** (${prop?.type || "unknown"}, ${isRequired}): ${prop?.description || ""}\n`;
    }
    md += `\n`;
  }

  // Execution history
  md += `## Recent Executions\n\n`;

  if (executionHistory.length === 0) {
    md += `No executions yet.\n\n`;
  } else {
    // Show last 5 executions
    const recentExecutions = executionHistory.slice(0, 5);
    md += `| Status | Started | Duration | Triggered By |\n`;
    md += `|--------|---------|----------|---------------|\n`;

    for (const exec of recentExecutions) {
      const statusEmoji = getStatusEmoji(exec.status);
      const duration = exec.durationMs ? `${(exec.durationMs / 1000).toFixed(1)}s` : "N/A";
      const startTime = formatDate(exec.startTime);

      md += `| ${statusEmoji} ${exec.status} | ${startTime} | ${duration} | ${exec.triggeredBy || "unknown"} |\n`;
    }
    md += `\n`;
  }

  return md;
}

function getTriggerTypeLabel(type: string): string {
  switch (type) {
    case "SCHEDULE":
      return "🕐 Scheduled";
    case "EVENT":
      return "⚡ Event-triggered";
    case "MANUAL":
      return "👆 Manual";
    default:
      return type;
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "SUCCEEDED":
      return "✅";
    case "FAILED":
      return "❌";
    case "RUNNING":
      return "⏳";
    case "PAUSED":
      return "⏸";
    case "SKIPPED":
      return "⊘";
    default:
      return "❓";
  }
}

function formatDate(date?: string): string {
  if (!date) return "N/A";

  try {
    const d = new Date(date);
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

async function handleExecuteWorkflow(
  workflow: Workflow,
  inputs: Record<string, string | number | boolean | undefined> | null,
) {
  try {
    // In real app, would POST to /platform/automation/v1/workflows/{id}/run
    console.log(`Executing workflow ${workflow.id}`, inputs);

    // Mock: create fake execution ID
    const executionId = `exec-${Date.now()}`;
    console.log(`Started execution: ${executionId}`);

    // In real app, would show HUD with executionId and start polling
  } catch (error) {
    console.error("Failed to execute workflow:", error);
  }
}
