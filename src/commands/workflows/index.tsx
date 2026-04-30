// B1: Workflows — List & Execute
import { List, Action, ActionPanel, Icon, Color, useNavigation } from "@raycast/api";
import { useDynatraceRest } from "../../lib/api/useRest";
import { getActiveTenant } from "../../lib/tenants";
import type { TenantConfig } from "../../lib/auth";
import { workflowListSchema } from "../../lib/types/workflow";
import type { Workflow } from "../../lib/types/workflow";
import { registerMock, isMockMode } from "../../lib/api/rest";
import { useState, useEffect } from "react";
import { MOCK_WORKFLOWS } from "../../lib/api/mock";
import WorkflowDetailView from "./workflow-detail";

export default function WorkflowsCommand() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [filterTrigger, setFilterTrigger] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string | null>(null);

  useEffect(() => {
    // Register mock data for workflows
    registerMock("/platform/automation/v1/workflows", MOCK_WORKFLOWS);
    getActiveTenant().then(setTenant);
  }, []);

  const {
    data: workflows = [],
    isLoading,
    error,
    revalidate,
  } = useDynatraceRest<Workflow[]>(tenant || undefined, "/platform/automation/v1/workflows", {
    schema: workflowListSchema,
    enabled: !!tenant,
  });

  const { push } = useNavigation();

  const handleSelectWorkflow = (workflow: Workflow) => {
    push(<WorkflowDetailView workflow={workflow} tenant={tenant} onRefresh={revalidate} />);
  };

  if (error) {
    return (
      <List>
        <List.EmptyView icon={Icon.Binoculars} title="Error" description={error} />
      </List>
    );
  }

  // Filter workflows
  let filteredWorkflows = workflows;
  if (filterTrigger) {
    filteredWorkflows = filteredWorkflows.filter((w) => w.triggerType === filterTrigger);
  }
  if (filterOwner) {
    filteredWorkflows = filteredWorkflows.filter((w) => w.owner === filterOwner);
  }

  if (!filteredWorkflows || filteredWorkflows.length === 0) {
    return (
      <List
        isLoading={isLoading}
        searchBarPlaceholder="Search workflows by name..."
        actions={
          <ActionPanel>
            <Action
              title="Clear Filters"
              onAction={() => {
                setFilterTrigger(null);
                setFilterOwner(null);
              }}
            />
          </ActionPanel>
        }
      >
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Workflows Found"
          description="No workflows configured in this tenant"
        />
      </List>
    );
  }

  // Get unique trigger types and owners for filtering
  const triggerTypes = Array.from(new Set(workflows.map((w) => w.triggerType)));
  const owners = Array.from(new Set(workflows.map((w) => w.owner).filter(Boolean))) as string[];

  // Group by status for display
  const enabled = filteredWorkflows.filter((w) => w.enabled);
  const disabled = filteredWorkflows.filter((w) => !w.enabled);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search workflows by name..."
      actions={
        <ActionPanel>
          <Action
            title="Clear Filters"
            onAction={() => {
              setFilterTrigger(null);
              setFilterOwner(null);
            }}
          />
        </ActionPanel>
      }
    >
      {enabled.length > 0 && (
        <List.Section title="🟢 Enabled">
          {enabled.map((workflow) => (
            <WorkflowListItem
              key={workflow.id}
              workflow={workflow}
              onSelect={handleSelectWorkflow}
            />
          ))}
        </List.Section>
      )}

      {disabled.length > 0 && (
        <List.Section title="⚫ Disabled">
          {disabled.map((workflow) => (
            <WorkflowListItem
              key={workflow.id}
              workflow={workflow}
              onSelect={handleSelectWorkflow}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

interface WorkflowListItemProps {
  workflow: Workflow;
  onSelect: (workflow: Workflow) => void;
}

function WorkflowListItem({ workflow, onSelect }: WorkflowListItemProps) {
  // Determine trigger icon
  const triggerIcon =
    workflow.triggerType === "SCHEDULE"
      ? "🕐"
      : workflow.triggerType === "EVENT"
        ? "⚡"
        : "👆";

  // Determine last execution status color
  const statusColor = workflow.lastExecutionStatus
    ? workflow.lastExecutionStatus === "SUCCEEDED"
      ? Color.Green
      : workflow.lastExecutionStatus === "RUNNING"
        ? Color.Yellow
        : Color.Red
    : Color.SecondaryText;

  const statusIcon = workflow.lastExecutionStatus
    ? workflow.lastExecutionStatus === "SUCCEEDED"
      ? Icon.Checkmark
      : workflow.lastExecutionStatus === "RUNNING"
        ? Icon.Hourglass
        : Icon.Binoculars
    : Icon.MinusCircle;

  const accessories: Array<{
    tag?: { value: string; color: Color };
    text?: string;
    icon?: { source: Icon; tintColor?: Color };
  }> = [];

  // Add trigger type as text
  accessories.push({
    text: triggerIcon,
  });

  // Add owner
  if (workflow.owner) {
    accessories.push({
      text: workflow.owner,
    });
  }

  // Add last execution status
  if (workflow.lastExecutionStatus) {
    accessories.push({
      icon: { source: statusIcon, tintColor: statusColor },
    });
  }

  // Add last execution time
  if (workflow.lastExecutionTime) {
    const now = new Date();
    const lastExecTime = new Date(workflow.lastExecutionTime);
    const diffMs = now.getTime() - lastExecTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeString = "";
    if (diffDays > 0) {
      timeString = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      timeString = `${diffHours}h ago`;
    } else if (diffMins > 0) {
      timeString = `${diffMins}m ago`;
    } else {
      timeString = "now";
    }

    accessories.push({
      text: timeString,
    });
  }

  return (
    <List.Item
      title={workflow.name}
      subtitle={workflow.description || "No description"}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action title="View Details" icon={Icon.Eye} onAction={() => onSelect(workflow)} />
        </ActionPanel>
      }
    />
  );
}
