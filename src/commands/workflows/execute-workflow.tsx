// B1-3, B1-4: Execute workflow with parameters
import { Form, Action, ActionPanel, showToast, Toast, useNavigation } from "@raycast/api";
import type { Workflow } from "../../lib/types/workflow";
import type { TenantConfig } from "../../lib/auth";
import { dynatraceRest } from "../../lib/api/rest";
import { useState } from "react";

interface ExecuteWorkflowFormProps {
  workflow: Workflow;
  tenant: TenantConfig | null;
  onSuccess?: () => void;
}

export default function ExecuteWorkflowForm({ workflow, tenant, onSuccess }: ExecuteWorkflowFormProps) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  // Parse input parameters from schema
  const parameters = buildFormParameters(workflow.inputParametersSchema);
  const schema = workflow.inputParametersSchema as { required?: string[] };
  const requiredParams = schema?.required || [];

  // Seed defaults from the workflow input schema so enum dropdowns and
  // pre-filled values match what the Workflows UI would send.
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean | undefined>>(() => {
    const initial: Record<string, string | number | boolean | undefined> = {};
    for (const param of parameters) {
      if (param.default !== undefined) initial[param.name] = param.default;
      else if (param.enum && param.enum.length > 0) initial[param.name] = param.enum[0];
    }
    return initial;
  });

  // A required field is missing only when it has no value at all.
  // `false` (boolean) and `0` (number) are valid filled values.
  const isMissing = (value: string | number | boolean | undefined): boolean =>
    value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Validate required fields
      for (const param of requiredParams) {
        if (isMissing(formValues[param])) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Missing Required Field",
            message: `${param} is required`,
          });
          setIsLoading(false);
          return;
        }
      }

      // Reject non-numeric input for number parameters instead of sending NaN
      for (const param of parameters) {
        if (
          param.type === "number" &&
          typeof formValues[param.name] === "number" &&
          Number.isNaN(formValues[param.name])
        ) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid Number",
            message: `${param.name} must be a valid number`,
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
              value={formValues[param.name]?.toString() || ""}
              onChange={(value) => setFormValues({ ...formValues, [param.name]: value ? Number(value) : undefined })}
              error={
                isRequired && isMissing(formValues[param.name])
                  ? "This field is required"
                  : typeof formValues[param.name] === "number" && Number.isNaN(formValues[param.name])
                    ? "Must be a valid number"
                    : undefined
              }
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
              value={formValues[param.name]?.toString() || ""}
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
              value={formValues[param.name]?.toString() || ""}
              onChange={(value) => setFormValues({ ...formValues, [param.name]: value })}
              error={isRequired && isMissing(formValues[param.name]) ? "This field is required" : undefined}
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
  default?: string | number | boolean;
}

function buildFormParameters(schema?: Record<string, unknown>): FormParameter[] {
  const typedSchema = schema as {
    properties?: Record<
      string,
      { type?: string; description?: string; enum?: string[]; default?: string | number | boolean }
    >;
  };
  if (!typedSchema || !typedSchema.properties) {
    return [];
  }

  const parameters: FormParameter[] = [];

  for (const [key, prop] of Object.entries(typedSchema.properties)) {
    parameters.push({
      name: key,
      type: prop?.type || "string",
      description: prop?.description,
      enum: prop?.enum,
      default: prop?.default,
    });
  }

  return parameters;
}

async function executeWorkflow(
  workflow: Workflow,
  inputs: Record<string, string | number | boolean | undefined>,
  tenant: TenantConfig | null,
): Promise<{ executionId: string }> {
  if (!tenant) {
    throw new Error("No tenant selected");
  }

  try {
    const response = await dynatraceRest<{ id: string }>(
      tenant,
      `/platform/automation/v1/workflows/${workflow.id}/run`,
      {
        method: "POST",
        body: { input: inputs },
      },
    );

    return { executionId: response.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to execute workflow: ${message}`);
  }
}
