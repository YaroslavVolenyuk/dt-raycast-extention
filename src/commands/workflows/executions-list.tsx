// B2-1, B2-2: Workflow executions list with pagination
import { List, Action, ActionPanel, Icon, Color, useNavigation } from "@raycast/api";
import type { WorkflowExecution } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { MOCK_WORKFLOW_EXECUTIONS } from "../../lib/api/mock";
import ExecutionDetailView from "./execution-detail.tsx";
import { useState } from "react";

interface ExecutionsListProps {
  workflowId: string;
  workflowName: string;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function ExecutionsList({ workflowId, workflowName, tenant, onRefresh }: ExecutionsListProps) {
  const { push } = useNavigation();
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  // Mock data - in real app, would fetch from /platform/automation/v1/workflows/{workflowId}/executions
  // with pagination support (nextPageKey)
  const allExecutions = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.workflowId === workflowId);

  // Sort by startTime descending (most recent first)
  const sortedExecutions = [...allExecutions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  // Paginate
  const totalPages = Math.ceil(sortedExecutions.length / pageSize);
  const paginatedExecutions = sortedExecutions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleSelectExecution = (execution: WorkflowExecution) => {
    push(
      <ExecutionDetailView
        execution={execution}
        workflowId={workflowId}
        workflowName={workflowName}
        tenant={tenant}
        onRefresh={onRefresh}
      />,
    );
  };

  if (sortedExecutions.length === 0) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Executions"
          description="This workflow has not been executed yet"
        />
      </List>
    );
  }

  return (
    <List
      searchBarPlaceholder="Filter executions by status..."
      actions={
        <ActionPanel>
          {pageIndex > 0 && (
            <Action title="Previous Page" icon={Icon.ChevronLeft} onAction={() => setPageIndex(pageIndex - 1)} />
          )}
          {pageIndex < totalPages - 1 && (
            <Action title="Next Page" icon={Icon.ChevronRight} onAction={() => setPageIndex(pageIndex + 1)} />
          )}
        </ActionPanel>
      }
    >
      <List.Section title={`Executions - Page ${pageIndex + 1} of ${totalPages} (${sortedExecutions.length} total)`}>
        {paginatedExecutions.map((execution) => (
          <ExecutionListItem key={execution.id} execution={execution} onSelect={handleSelectExecution} />
        ))}
      </List.Section>
    </List>
  );
}

interface ExecutionListItemProps {
  execution: WorkflowExecution;
  onSelect: (execution: WorkflowExecution) => void;
}

function ExecutionListItem({ execution, onSelect }: ExecutionListItemProps) {
  const statusColor =
    execution.status === "SUCCEEDED"
      ? Color.Green
      : execution.status === "FAILED"
        ? Color.Red
        : execution.status === "RUNNING"
          ? Color.Yellow
          : Color.SecondaryText;

  const statusIcon =
    execution.status === "SUCCEEDED"
      ? Icon.Checkmark
      : execution.status === "FAILED"
        ? Icon.XMarkCircle
        : execution.status === "RUNNING"
          ? Icon.Hourglass
          : Icon.CircleFilled;

  // Format start time
  let startTimeStr = "";
  try {
    const d = new Date(execution.startTime);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      startTimeStr = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      startTimeStr = `${diffHours}h ago`;
    } else if (diffMins > 0) {
      startTimeStr = `${diffMins}m ago`;
    } else {
      startTimeStr = "now";
    }
  } catch {
    startTimeStr = "Invalid date";
  }

  // Duration
  const durationStr = execution.durationMs
    ? formatDuration(execution.durationMs)
    : execution.status === "RUNNING"
      ? "Running..."
      : "—";

  const accessories: Array<{
    tag?: { value: string; color: Color };
    text?: string;
    icon?: { source: Icon; tintColor?: Color };
  }> = [];

  // Status icon
  accessories.push({
    icon: { source: statusIcon, tintColor: statusColor },
  });

  // Duration
  accessories.push({
    text: durationStr,
  });

  // Time
  accessories.push({
    text: startTimeStr,
  });

  return (
    <List.Item
      title={`${execution.status}`}
      subtitle={`ID: ${execution.id} • Triggered: ${execution.triggeredBy || "unknown"}`}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="View Details" icon={Icon.Eye} onAction={() => onSelect(execution)} />
        </ActionPanel>
      }
    />
  );
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
