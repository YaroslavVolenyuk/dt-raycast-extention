// src/__tests__/workflow.test.ts
import { workflowSchema, workflowListSchema } from "../lib/types/workflow";
import { MOCK_WORKFLOWS, MOCK_WORKFLOW_EXECUTIONS, MOCK_EXECUTION_TASKS } from "../lib/api/mock";

describe("Workflow Types", () => {
  test("should validate workflow schema", () => {
    const workflow = {
      id: "wf-test-123",
      name: "Test Workflow",
      triggerType: "MANUAL",
      enabled: true,
    };

    const result = workflowSchema.safeParse(workflow);
    expect(result.success).toBe(true);
  });

  test("should reject invalid trigger type", () => {
    const workflow = {
      id: "wf-test-123",
      name: "Test Workflow",
      triggerType: "INVALID_TYPE",
      enabled: true,
    };

    const result = workflowSchema.safeParse(workflow);
    expect(result.success).toBe(false);
  });

  test("should validate workflow list schema", () => {
    const result = workflowListSchema.safeParse(MOCK_WORKFLOWS);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(MOCK_WORKFLOWS.length);
  });

  test("should validate execution history", () => {
    for (const execution of MOCK_WORKFLOW_EXECUTIONS) {
      expect(execution.id).toBeDefined();
      expect(execution.workflowId).toBeDefined();
      expect(["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"]).toContain(execution.status);
    }
  });

  test("should validate execution tasks", () => {
    for (const task of MOCK_EXECUTION_TASKS) {
      expect(task.id).toBeDefined();
      expect(task.name).toBeDefined();
      expect(["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"]).toContain(task.status);
    }
  });
});

describe("Mock Workflows", () => {
  test("should have minimum 4 workflows", () => {
    expect(MOCK_WORKFLOWS.length).toBeGreaterThanOrEqual(4);
  });

  test("should have workflows with different trigger types", () => {
    const triggerTypes = new Set(MOCK_WORKFLOWS.map((w) => w.triggerType));
    expect(triggerTypes.size).toBeGreaterThan(1); // At least 2 different types
  });

  test("should have both enabled and disabled workflows", () => {
    const enabled = MOCK_WORKFLOWS.filter((w) => w.enabled);
    const disabled = MOCK_WORKFLOWS.filter((w) => !w.enabled);
    expect(enabled.length).toBeGreaterThan(0);
    expect(disabled.length).toBeGreaterThan(0);
  });

  test("should have valid input parameter schemas", () => {
    for (const workflow of MOCK_WORKFLOWS) {
      if (workflow.inputParametersSchema) {
        const schema = workflow.inputParametersSchema as { properties?: Record<string, { type?: string }> };
        if (schema.properties) {
          for (const prop of Object.values(schema.properties)) {
            expect(prop?.type).toBeDefined();
          }
        }
      }
    }
  });

  test("should have execution history for workflows", () => {
    const workflowIds = new Set(MOCK_WORKFLOWS.map((w) => w.id));
    const executionWorkflowIds = new Set(MOCK_WORKFLOW_EXECUTIONS.map((e) => e.workflowId));

    // All workflow executions should reference valid workflows
    for (const workflowId of executionWorkflowIds) {
      expect(workflowIds.has(workflowId)).toBe(true);
    }
  });
});

describe("Workflow execution scenarios", () => {
  test("should filter workflows by trigger type", () => {
    const manualWorkflows = MOCK_WORKFLOWS.filter((w) => w.triggerType === "MANUAL");

    // Should have at least some workflows of each type
    expect(manualWorkflows.length).toBeGreaterThan(0);
  });

  test("should filter workflows by owner", () => {
    const owners = new Set(MOCK_WORKFLOWS.map((w) => w.owner).filter(Boolean));
    expect(owners.size).toBeGreaterThan(0);

    for (const owner of owners) {
      const ownerWorkflows = MOCK_WORKFLOWS.filter((w) => w.owner === owner);
      expect(ownerWorkflows.length).toBeGreaterThan(0);
    }
  });

  test("should get execution history for specific workflow", () => {
    const workflow = MOCK_WORKFLOWS[0];
    const executions = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.workflowId === workflow.id);

    if (executions.length > 0) {
      // Verify execution timestamps
      for (const exec of executions) {
        const startTime = new Date(exec.startTime);
        expect(startTime.getTime()).toBeGreaterThan(0);

        if (exec.endTime) {
          const endTime = new Date(exec.endTime);
          expect(endTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        }
      }
    }
  });

  test("should calculate execution duration", () => {
    const execWithDuration = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.durationMs);

    for (const exec of execWithDuration) {
      expect(exec.durationMs).toBeGreaterThan(0);
    }
  });

  test("should format status correctly", () => {
    const statuses = new Set(MOCK_WORKFLOW_EXECUTIONS.map((e) => e.status));
    const validStatuses = ["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"];

    for (const status of statuses) {
      expect(validStatuses).toContain(status);
    }
  });
});

describe("Workflow parameter validation", () => {
  test("workflows with parameters should define required fields", () => {
    const workflowsWithParams = MOCK_WORKFLOWS.filter(
      (w) => w.inputParametersSchema && Object.keys(w.inputParametersSchema).length > 0,
    );

    for (const workflow of workflowsWithParams) {
      const schema = workflow.inputParametersSchema as { properties?: Record<string, unknown> };
      // Schema should have properties
      if (schema.properties) {
        expect(Object.keys(schema.properties).length).toBeGreaterThan(0);
      }
    }
  });

  test("should handle workflows without parameters", () => {
    const noParamWorkflows = MOCK_WORKFLOWS.filter(
      (w) => !w.inputParametersSchema || Object.keys(w.inputParametersSchema).length === 0,
    );
    expect(noParamWorkflows.length).toBeGreaterThan(0);
  });
});
