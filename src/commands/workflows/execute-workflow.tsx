// B1-3, B1-4: Execute workflow with parameters
import {
  Form,
  Action,
  ActionPanel,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import type { Workflow } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { useState } from "react";

interface ExecuteWorkflowFormProps {
  workflow: Workflow;
  tenant: TenantConfig | null;
  onSuccess?: () => void;
}

export default function ExecuteWorkflowForm({
  workflow,
  tenant,
  onSuccess,
}: ExecuteWorkflowFormProps) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Parse input parameters from schema
  const parameters = buildFormParameters(workflow.inputParametersSchema);
  const requiredParams = (workflow.inputParametersSchema as any)?.required || [];

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Validate required fields
      for (const param of requiredParams) {
        if (!formValues[param]) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Missing Required Field",
            message: `${param} is required`,
          });
          setIsLoading(false);
          return;
        }
      }

      // Execute workflow
      const result = await executeWorkflow(workflow, formValues, tenant);

      await showToast({
        style: Toast.Style.Success,
        title: "Workflow Started",
        message: `Execution ID: ${result.executionId}`,
      });

      onSuccess?.();
      pop();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Execution Failed",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Execute Workflow" onSubmit={handleSubmit} />
          <Action title="Cancel" onAction={pop} />
        </ActionPanel>
      }
    >
      <Form.Description title={workflow.name} text={workflow.description || "No description"} />

      {/* Build form fields dynamically from schema */}
      {parameters.map((param) => {
        const isRequired = requiredParams.includes(param.name);

        if (param.type === "number") {
          return (
            <Form.TextField
              key={param.name}
              id={param.name}
              title={param.name}
              placeholder={param.description || ""}
              value={formValues[param.name] || ""}
              onChange={(value) =>
                setFormValues({ ...formValues, [param.name]: value ? Number(value) : undefined })
              }
              error={isRequired && !formValues[param.name] ? "This field is required" : undefined}
            />
          );
        } else if (param.type === "boolean") {
          return (
            <Form.Checkbox
              key={param.name}
              id={param.name}
              label={param.name}
              value={Boolean(formValues[param.name])}
              onChange={(value) => setFormValues({ ...formValues, [param.name]: value })}
            />
          );
        } else if (param.enum) {
          // Enum dropdown
          return (
            <Form.Dropdown
              key={param.name}
              id={param.name}
              title={param.name}
              value={formValues[param.name] || ""}
              onChange={(value) => setFormValues({ ...formValues, [param.name]: value })}
            >
              {param.enum.map((option) => (
                <Form.Dropdown.Item key={option} value={option} title={option} />
              ))}
            </Form.Dropdown>
          );
        } else {
          // Default to text field
          return (
            <Form.TextField
              key={param.name}
              id={param.name}
              title={param.name}
              placeholder={param.description || ""}
              value={formValues[param.name] || ""}
              onChange={(value) => setFormValues({ ...formValues, [param.name]: value })}
              error={isRequired && !formValues[param.name] ? "This field is required" : undefined}
            />
          );
        }
      })}
    </Form>
  );
}

interface FormParameter {
  name: string;
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
}

function buildFormParameters(schema?: any): FormParameter[] {
  if (!schema || !schema.properties) {
    return [];
  }

  const parameters: FormParameter[] = [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const propObj = prop as any;
    parameters.push({
      name: key,
      type: propObj.type || "string",
      description: propObj.description,
      enum: propObj.enum,
      default: propObj.default,
    });
  }

  return parameters;
}

async function executeWorkflow(
  workflow: Workflow,
  inputs: Record<string, any>,
  tenant: TenantConfig | null
): Promise<{ executionId: string }> {
  // In real app, would POST to /platform/automation/v1/workflows/{id}/run
  // with body: { input: inputs }

  if (!tenant) {
    throw new Error("No tenant selected");
  }

  // Mock implementation
  const executionId = `exec-${Date.now()}`;

  // In real app:
  // const response = await fetch(`${tenant.url}/api/v2/workflows/${workflow.id}/run`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${token}` },
  //   body: JSON.stringify({ input: inputs }),
  // });

  return { executionId };
}
