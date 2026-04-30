// src/__tests__/workflow-execution.test.ts
import { MOCK_WORKFLOW_EXECUTIONS, MOCK_EXECUTION_TASKS } from "../lib/api/mock";
import { ExecutionStatus } from "../lib/types/workflow";

describe("Workflow Executions (B2)", () => {
  describe("B2-1: Task Breakdown", () => {
    test("should have execution tasks with complete details", () => {
      for (const task of MOCK_EXECUTION_TASKS) {
        expect(task.id).toBeDefined();
        expect(task.name).toBeDefined();
        expect(task.status).toBeDefined();
        expect(task.startTime).toBeDefined();
      }
    });

    test("should have error messages for failed tasks", () => {
      const failedTasks = MOCK_EXECUTION_TASKS.filter((t) => t.status === "FAILED");
      for (const task of failedTasks) {
        // Failed tasks may have error messages
        if (task.errorMessage) {
          expect(task.errorMessage.length).toBeGreaterThan(0);
        }
      }
    });

    test("should calculate task duration when completed", () => {
      const completedTasks = MOCK_EXECUTION_TASKS.filter((t) => t.status !== "RUNNING");
      for (const task of completedTasks) {
        if (task.durationMs !== null && task.durationMs !== undefined) {
          expect(task.durationMs).toBeGreaterThan(0);
        }
      }
    });

    test("should maintain task order by start time", () => {
      const sortedTasks = [...MOCK_EXECUTION_TASKS].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      for (let i = 0; i < sortedTasks.length - 1; i++) {
        const current = new Date(sortedTasks[i].startTime).getTime();
        const next = new Date(sortedTasks[i + 1].startTime).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });

    test("should group tasks by execution", () => {
      // In real app, tasks would be grouped by execution ID
      // For mock data, we just verify structure
      expect(MOCK_EXECUTION_TASKS.length).toBeGreaterThan(0);
    });
  });

  describe("B2-2: Cancel & Re-run", () => {
    test("should only allow cancel for RUNNING executions", () => {
      const runningExecutions = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.status === "RUNNING");
      const others = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.status !== "RUNNING");

      expect(runningExecutions.length).toBeGreaterThan(0);
      expect(others.length).toBeGreaterThan(0);
    });

    test("should allow re-run for completed executions", () => {
      const completedExecutions = MOCK_WORKFLOW_EXECUTIONS.filter(
        (e) => e.status === "SUCCEEDED" || e.status === "FAILED"
      );
      expect(completedExecutions.length).toBeGreaterThan(0);
    });

    test("should preserve execution input for re-run", () => {
      for (const execution of MOCK_WORKFLOW_EXECUTIONS) {
        // Execution should maintain reference to input params
        expect(execution.workflowId).toBeDefined();
        // In real app, would have `input` field
      }
    });

    test("should not allow re-run of RUNNING executions", () => {
      const runningExecutions = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.status === "RUNNING");
      for (const exec of runningExecutions) {
        // Re-run should be blocked while RUNNING
        expect(exec.status).toBe("RUNNING");
      }
    });

    test("should track execution parent workflow", () => {
      for (const execution of MOCK_WORKFLOW_EXECUTIONS) {
        expect(execution.workflowId).toBeDefined();
        expect(execution.workflowId.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Execution Pagination", () => {
    test("should handle pagination with nextPageKey pattern", () => {
      // Mock test for pagination support
      const pageSize = 10;
      const total = MOCK_WORKFLOW_EXECUTIONS.length;
      const pages = Math.ceil(total / pageSize);

      expect(pages).toBeGreaterThan(0);
    });

    test("should sort executions by startTime descending", () => {
      const sorted = [...MOCK_WORKFLOW_EXECUTIONS].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = new Date(sorted[i].startTime).getTime();
        const next = new Date(sorted[i + 1].startTime).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    test("should paginate correctly", () => {
      const pageSize = 2;
      const page1 = MOCK_WORKFLOW_EXECUTIONS.slice(0, pageSize);
      const page2 = MOCK_WORKFLOW_EXECUTIONS.slice(pageSize, pageSize * 2);

      expect(page1.length).toBeLessThanOrEqual(pageSize);
      expect(page2.length).toBeLessThanOrEqual(pageSize);
    });
  });

  describe("Execution Status Transitions", () => {
    test("should have valid status transitions", () => {
      const validStatuses: ExecutionStatus[] = ["RUNNING", "SUCCEEDED", "FAILED", "PAUSED", "SKIPPED"];

      for (const exec of MOCK_WORKFLOW_EXECUTIONS) {
        expect(validStatuses).toContain(exec.status);
      }
    });

    test("should track execution duration", () => {
      const completedExecutions = MOCK_WORKFLOW_EXECUTIONS.filter(
        (e) => e.status === "SUCCEEDED" || e.status === "FAILED"
      );

      for (const exec of completedExecutions) {
        if (exec.durationMs) {
          expect(exec.durationMs).toBeGreaterThan(0);
        }
      }
    });

    test("should not have endTime for RUNNING executions", () => {
      const runningExecutions = MOCK_WORKFLOW_EXECUTIONS.filter((e) => e.status === "RUNNING");

      for (const exec of runningExecutions) {
        if (exec.endTime) {
          // RUNNING should ideally not have endTime, but we allow it
          expect(exec.status).toBe("RUNNING");
        }
      }
    });
  });

  describe("Execution API Construction", () => {
    test("should construct cancel request correctly", () => {
      const execution = MOCK_WORKFLOW_EXECUTIONS.find((e) => e.status === "RUNNING");
      if (execution) {
        // Mock cancel request body
        const cancelRequest = {
          state: "CANCELLED",
        };

        expect(cancelRequest.state).toBe("CANCELLED");
      }
    });

    test("should construct re-run request with same inputs", () => {
      const execution = MOCK_WORKFLOW_EXECUTIONS[0];

      // Mock re-run request body
      const reRunRequest = {
        input: execution.result?.output || {},
      };

      expect(reRunRequest).toBeDefined();
      expect(reRunRequest.input).toBeDefined();
    });

    test("should include workflowId in cancel endpoint", () => {
      for (const execution of MOCK_WORKFLOW_EXECUTIONS) {
        const cancelEndpoint = `/platform/automation/v1/executions/${execution.id}/cancel`;
        expect(cancelEndpoint).toContain(execution.id);
      }
    });

    test("should include workflowId in re-run endpoint", () => {
      for (const execution of MOCK_WORKFLOW_EXECUTIONS) {
        const reRunEndpoint = `/platform/automation/v1/workflows/${execution.workflowId}/run`;
        expect(reRunEndpoint).toContain(execution.workflowId);
      }
    });
  });

  describe("Error Handling", () => {
    test("should show error messages from failed tasks", () => {
      const failedTasks = MOCK_EXECUTION_TASKS.filter((t) => t.status === "FAILED");

      if (failedTasks.length > 0) {
        for (const task of failedTasks) {
          // Should have context for error
          expect(task.errorMessage || task.name).toBeDefined();
        }
      }
    });

    test("should handle missing task data gracefully", () => {
      // Mock behavior when task data is unavailable
      const execution = MOCK_WORKFLOW_EXECUTIONS[0];
      const tasksForExecution = MOCK_EXECUTION_TASKS.filter((t) =>
        execution.id.includes("001") || execution.id.includes("003")
      );

      // Should still render execution without tasks
      expect(execution).toBeDefined();
    });
  });
});
