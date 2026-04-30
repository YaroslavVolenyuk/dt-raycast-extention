// B2-1: Execution detail view with task breakdown
import { Detail, Action, ActionPanel, Icon, Color, showToast, Toast, useNavigation } from "@raycast/api";
import type { WorkflowExecution, ExecutionTask } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { MOCK_EXECUTION_TASKS } from "../../lib/api/mock";
import { useState } from "react";

interface ExecutionDetailViewProps {
  execution: WorkflowExecution;
  workflowId: string;
  workflowName: string;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function ExecutionDetailView({
  execution,
  workflowId,
  workflowName,
  tenant,
  onRefresh,
}: ExecutionDetailViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();

  // Mock task data - in real app, would fetch from /platform/automation/v1/executions/{id}/tasks
  const tasks: ExecutionTask[] = MOCK_EXECUTION_TASKS.filter(
    (t) => execution.id.includes("001") || execution.id.includes("003")
  );

  const markdown = buildExecutionDetail(execution, tasks, workflowName);

  const handleCancel = async () => {
    if (execution.status !== "RUNNING") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot Cancel",
        message: "Only running executions can be cancelled",
      });
      return;
    }

    setIsLoading(true);
    try {
      // In real app: PATCH /platform/automation/v1/executions/{id}/cancel
      // with body: { state: "CANCELLED" }
      await cancelExecution(execution.id, tenant);
      await showToast({
        style: Toast.Style.Success,
        title: "Execution Cancelled",
        message: `Execution ${execution.id} has been cancelled`,
      });
      onRefresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Cancel Failed",
        message: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReRun = async () => {
    if (execution.status === "RUNNING") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot Re-run",
        message: "Execution is still running. Wait for it to complete.",
      });
      return;
    }

    setIsLoading(true);
    try {
      // In real app: POST /platform/automation/v1/workflows/{workflowId}/run
      // with same inputs as original execution
      await reRunExecution(workflowId, execution, tenant);
      await showToast({
        style: Toast.Style.Success,
        title: "Workflow Re-started",
        message: `New execution started for ${workflowName}`,
      });
      onRefresh();
      pop();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Re-run Failed",
        message: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          {execution.status === "RUNNING" && (
            <Action
              title="Cancel Execution"
              icon={Icon.XMark}
              style={Action.Style.Destructive}
              onAction={handleCancel}
            />
          )}
          {execution.status !== "RUNNING" && (
            <Action title="Re-run Workflow" icon={Icon.RotateClockwise} onAction={handleReRun} />
          )}
          <Action title="Refresh" icon={Icon.RotateClockwise} onAction={onRefresh} />
          <Action title="Back" icon={Icon.ChevronLeft} onAction={pop} />
        </ActionPanel>
      }
    />
  );
}

function buildExecutionDetail(
  execution: WorkflowExecution,
  tasks: ExecutionTask[],
  workflowName: string
): string {
  let md = `# Execution Details\n\n`;
  md += `**Workflow:** ${workflowName}\n`;
  md += `**Execution ID:** \`${execution.id}\`\n\n`;

  // Status banner
  const statusEmoji = getStatusEmoji(execution.status);
  md += `## ${statusEmoji} ${execution.status}\n\n`;

  // Timeline
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

  // Task breakdown
  if (tasks.length > 0) {
    md += `## Task Breakdown (${tasks.length} tasks)\n\n`;
    md += `| # | Task | Status | Duration | Notes |\n`;
    md += `|---|------|--------|----------|-------|\n`;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const statusEmoji = getStatusEmoji(task.status);
      const duration = task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : "—";
      const notes = task.errorMessage ? `⚠️ ${task.errorMessage}` : "—";

      md += `| ${i + 1} | **${task.name}** | ${statusEmoji} ${task.status} | ${duration} | ${notes} |\n`;
    }

    md += `\n`;

    // Error details section
    const failedTasks = tasks.filter((t) => t.status === "FAILED" && t.errorMessage);
    if (failedTasks.length > 0) {
      md += `## Error Details\n\n`;
      for (const task of failedTasks) {
        md += `### ${task.name}\n`;
        md += `\`\`\`\n${task.errorMessage}\n\`\`\`\n\n`;
      }
    }
  } else {
    md += `No task breakdown available for this execution.\n\n`;
  }

  // Execution output (if available)
  if (execution.result?.output) {
    md += `## Execution Output\n\n`;
    md += `\`\`\`json\n${JSON.stringify(execution.result.output, null, 2)}\n\`\`\`\n\n`;
  }

  return md;
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

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
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

async function cancelExecution(executionId: string, tenant: TenantConfig | null): Promise<void> {
  if (!tenant) {
    throw new Error("No tenant selected");
  }

  // In real app:
  // const response = await fetch(
  //   `${tenant.url}/api/v2/executions/${executionId}/cancel`,
  //   {
  //     method: "PATCH",
  //     headers: { Authorization: `Bearer ${token}` },
  //     body: JSON.stringify({ state: "CANCELLED" }),
  //   }
  // );

  // Mock success
  console.log(`Cancelled execution: ${executionId}`);
}

async function reRunExecution(
  workflowId: string,
  execution: WorkflowExecution,
  tenant: TenantConfig | null
): Promise<string> {
  if (!tenant) {
    throw new Error("No tenant selected");
  }

  // In real app:
  // const response = await fetch(
  //   `${tenant.url}/api/v2/workflows/${workflowId}/run`,
  //   {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${token}` },
  //     body: JSON.stringify({ input: execution.result?.output || {} }),
  //   }
  // );

  // Mock - generate new execution ID
  const newExecutionId = `exec-${Date.now()}`;
  console.log(`Re-ran execution: ${workflowId} -> ${newExecutionId}`);

  return newExecutionId;
}
