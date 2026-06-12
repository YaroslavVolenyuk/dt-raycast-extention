// B1-2: Workflow detail view
import { Detail, Action, ActionPanel, Icon, useNavigation, open } from "@raycast/api";
import { buildDeepLink } from "../../lib/utils/deepLinks";
import type { Workflow, WorkflowStep } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { dynatraceRest } from "../../lib/api/rest";
import ExecuteWorkflowForm from "./execute-workflow";
import ExecutionsList from "./executions-list";
import { useEffect, useState } from "react";

interface WorkflowDetailViewProps {
  workflow: Workflow;
  tenant: TenantConfig | null;
  onRefresh: () => void;
}

export default function WorkflowDetailView({ workflow, tenant, onRefresh }: WorkflowDetailViewProps) {
  const { push } = useNavigation();
  const [workflowTasks, setWorkflowTasks] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealData, setIsRealData] = useState(false);
  const [apiWorkflowData, setApiWorkflowData] = useState<Record<string, unknown> | null>(null);

  // Fetch workflow details from API (only if tenant is available)
  useEffect(() => {
    if (!tenant) {
      return;
    }

    // Try various endpoint patterns
    const endpointsToTry = [
      `/platform/automation/v1/workflows/${workflow.id}?includeExecutionHistory=true`,
      `/platform/automation/v1/workflows/${workflow.id}?includeHistory=true`,
      `/platform/automation/v1/workflows/${workflow.id}?include=executionHistory`,
      `/platform/automation/v1/workflows/${workflow.id}?include=history`,
      `/platform/automation/v1/workflows/${workflow.id}/executions`,
      `/api/v2/workflows/${workflow.id}/executions`,
      `/api/v2/automation/workflows/${workflow.id}/executions`,
      `/api/v2/automations/${workflow.id}/executions`,
      `/api/v2/automations/workflows/${workflow.id}/executions`,
      `/platform/automation/v1/workflows/${workflow.id}`, // Works! Returns workflow details
      `/api/v2/workflows/${workflow.id}`,
      `/api/v2/automations/${workflow.id}`,
    ];

    setIsLoading(true);

    const attemptEndpoint = async (endpoint: string): Promise<boolean> => {
      try {
        const response = await dynatraceRest<Record<string, unknown>>(tenant, endpoint, { method: "GET" });

        // Try to extract tasks from various possible response structures
        let tasks: WorkflowStep[] = [];

        const tasksObj = (response.data as Record<string, unknown>)?.tasks;
        if (tasksObj && typeof tasksObj === "object" && tasksObj !== null) {
          tasks = Object.entries(tasksObj).map(([key, value]: [string, unknown]) => {
            const val = value as Record<string, unknown>;
            return {
              id: key,
              name: (val?.name as string) || key,
              type: (val?.type as string) || "action",
              description: (val?.description as string) || "",
              order: 0,
            } as WorkflowStep;
          });
        }

        // If we got workflow details with tasks, consider it a success
        if (endpoint.includes("workflows/") && (tasks.length > 0 || response.data?.id)) {
          setWorkflowTasks(tasks);
          setApiWorkflowData(response.data);
          setIsRealData(true);
          return true;
        }

        return false;
      } catch {
        return false;
      }
    };

    const tryAllEndpoints = async () => {
      for (let i = 0; i < endpointsToTry.length; i++) {
        const success = await attemptEndpoint(endpointsToTry[i]);
        if (success) {
          setIsLoading(false);
          return;
        }
      }

      // Show empty if all endpoints fail
      setIsRealData(false);
      setIsLoading(false);
    };

    tryAllEndpoints();
  }, [tenant, workflow.id]);

  // Build markdown detail view - use API data if available, otherwise fall back to workflow prop
  const markdown = buildWorkflowDetail(workflow, isRealData, apiWorkflowData, workflowTasks);

  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading}
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
                handleExecuteWorkflow(workflow, null, tenant);
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
            onAction={async () => {
              if (tenant) {
                await open(buildDeepLink("workflow", workflow.id, tenant));
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

function buildWorkflowDetail(
  workflow: Workflow,
  isRealData: boolean = false,
  apiData: Record<string, unknown> | null = null,
  apiTasks: WorkflowStep[] = [],
): string {
  // Use API data if available, otherwise use workflow prop
  const title = apiData?.title || workflow.name;
  const description = apiData?.description || workflow.description;
  const owner = apiData?.owner || workflow.owner;
  const triggerType = (apiData?.triggerType as string | undefined) || workflow.triggerType;
  const isDeployed = apiData?.isDeployed !== undefined ? apiData.isDeployed : workflow.enabled;
  const modificationInfo = apiData?.modificationInfo as Record<string, unknown> | undefined;
  const createdDate = modificationInfo?.createdTime as string | undefined;
  const modifiedDate = modificationInfo?.lastModifiedTime as string | undefined;

  let md = `# ${title}`;

  // Add indicator for real vs mock data
  if (isRealData) {
    md += ` [Live]`;
  } else {
    md += ` [Mock Data]`;
  }

  md += `\n\n`;

  // Description
  if (description) {
    md += `${description}\n\n`;
  }

  // Basic info
  md += `## Configuration\n\n`;
  md += `| Property | Value |\n`;
  md += `|----------|-------|\n`;
  md += `| **ID** | \`${workflow.id}\` |\n`;
  md += `| **Owner** | ${owner || "Unknown"} |\n`;
  md += `| **Status** | ${isDeployed ? "Deployed" : "Not Deployed"} |\n`;
  md += `| **Trigger Type** | ${getTriggerTypeLabel(triggerType)} |\n`;
  md += `| **Created** | ${formatDate(createdDate || workflow.createdAt)} |\n`;
  md += `| **Modified** | ${formatDate(modifiedDate || workflow.modifiedAt)} |\n\n`;

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

  // Workflow steps/tasks - use API data if available
  const stepsToDisplay = apiTasks.length > 0 ? apiTasks : workflow.steps || [];

  if (stepsToDisplay.length > 0) {
    md += `## Workflow Steps\n\n`;
    md += `| # | Step | Type | Description |\n`;
    md += `|---|------|:----:|-------------|\n`;

    const sortedSteps = [...stepsToDisplay].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const stepNum = i + 1;
      md += `| ${stepNum} | **${step.name}** | \`${step.type}\` | ${step.description || ""} |\n`;
    }
    md += `\n`;
  }

  return md;
}

function getTriggerTypeLabel(type: string): string {
  switch (type) {
    case "SCHEDULE":
      return "Scheduled";
    case "EVENT":
      return "Event-triggered";
    case "MANUAL":
      return "Manual";
    default:
      return type;
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
  tenant: TenantConfig | null,
) {
  try {
    if (!tenant) {
      throw new Error("No tenant selected");
    }

    await dynatraceRest<{ id: string }>(tenant, `/platform/automation/v1/workflows/${workflow.id}/run`, {
      method: "POST",
      body: { input: inputs || {} },
    });
  } catch {
    // Error handling in parent component
  }
}
