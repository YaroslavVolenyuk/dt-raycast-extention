import { describe, expect, it } from "@jest/globals";
import {
  ProblemSeverity,
  StatusDashboard,
  getDashboardSeverity,
  hasIssues,
  formatLastChecked,
} from "../lib/types/status";

describe("Status Dashboard", () => {
  describe("getDashboardSeverity", () => {
    it("should return 'healthy' when no issues", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: { total: 0, bySeverity: {}, items: [] },
        slos: { total: 0, violated: 0, items: [] },
        synthetics: { total: 0, failing: 0, items: [] },
        deployments: null,
      };

      expect(getDashboardSeverity(status)).toBe("healthy");
    });

    it("should return 'critical' when CRITICAL problems exist", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: {
          total: 2,
          bySeverity: {
            [ProblemSeverity.CRITICAL]: 1,
            [ProblemSeverity.MAJOR]: 1,
            [ProblemSeverity.MINOR]: 0,
            [ProblemSeverity.WARNING]: 0,
          },
          items: [
            {
              id: "1",
              title: "Critical issue",
              severity: ProblemSeverity.CRITICAL,
              status: "OPEN",
              timestamp: Date.now(),
              systemProfile: "test",
              description: "",
              impact: "",
              sourceEventType: "",
              recoveryInfo: "",
              managementZones: [],
              affectedEntities: [],
              resolveTime: 0,
            },
          ],
        },
        slos: null,
        synthetics: null,
        deployments: null,
      };

      expect(getDashboardSeverity(status)).toBe("critical");
    });

    it("should return 'warning' when SLOs violated", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: { total: 0, bySeverity: {}, items: [] },
        slos: {
          total: 2,
          violated: 1,
          items: [
            {
              id: "1",
              name: "SLO 1",
              target: 99.5,
              warning: 95,
              compliance: 95,
              errorBudgetRemaining: 0.5,
              timeframe: "7d",
              enabled: true,
            },
          ],
        },
        synthetics: null,
        deployments: null,
      };

      expect(getDashboardSeverity(status)).toBe("warning");
    });

    it("should return 'warning' when synthetics failing", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: { total: 0, bySeverity: {}, items: [] },
        slos: { total: 0, violated: 0, items: [] },
        synthetics: {
          total: 1,
          failing: 1,
          items: [] as any,
        },
        deployments: null,
      };

      expect(getDashboardSeverity(status)).toBe("warning");
    });
  });

  describe("hasIssues", () => {
    it("should return true when problems exist", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: { total: 1, bySeverity: {}, items: [] },
        slos: null,
        synthetics: null,
        deployments: null,
      };

      expect(hasIssues(status)).toBe(true);
    });

    it("should return true when SLOs violated", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: null,
        slos: { total: 1, violated: 1, items: [] },
        synthetics: null,
        deployments: null,
      };

      expect(hasIssues(status)).toBe(true);
    });

    it("should return true when synthetics failing", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: null,
        slos: null,
        synthetics: { total: 1, failing: 1, items: [] as any },
        deployments: null,
      };

      expect(hasIssues(status)).toBe(true);
    });

    it("should return false when all healthy", () => {
      const status: StatusDashboard = {
        lastChecked: Date.now(),
        problems: { total: 0, bySeverity: {}, items: [] },
        slos: { total: 0, violated: 0, items: [] },
        synthetics: { total: 0, failing: 0, items: [] as any },
        deployments: null,
      };

      expect(hasIssues(status)).toBe(false);
    });
  });

  describe("formatLastChecked", () => {
    it("should return 'just now' for recent timestamp", () => {
      const now = Date.now();
      const formatted = formatLastChecked(now);

      expect(formatted).toBe("just now");
    });

    it("should return minute-based format", () => {
      const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const formatted = formatLastChecked(timestamp);

      expect(formatted).toBe("5 min ago");
    });

    it("should return '1 min ago' for exactly 1 minute", () => {
      const timestamp = Date.now() - 60 * 1000; // 1 minute ago
      const formatted = formatLastChecked(timestamp);

      expect(formatted).toBe("1 min ago");
    });

    it("should return hour-based format", () => {
      const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const formatted = formatLastChecked(timestamp);

      expect(formatted).toBe("2 hours ago");
    });

    it("should return '1 hour ago' for exactly 1 hour", () => {
      const timestamp = Date.now() - 60 * 60 * 1000; // 1 hour ago
      const formatted = formatLastChecked(timestamp);

      expect(formatted).toBe("1 hour ago");
    });

    it("should return day-based format", () => {
      const timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const formatted = formatLastChecked(timestamp);

      expect(formatted).toMatch(/\d+ day ago/);
    });
  });

  describe("Promise.allSettled graceful degradation", () => {
    it("should handle when one API fails", async () => {
      const results = await Promise.allSettled([
        Promise.resolve({ data: "success" }),
        Promise.reject(new Error("API failed")),
        Promise.resolve({ data: "success 2" }),
      ]);

      // Should have 3 results, one rejected
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });

    it("should process fulfilled results even with rejections", async () => {
      const results = await Promise.allSettled([
        Promise.resolve("value1"),
        Promise.reject(new Error("error")),
      ]);

      const fulfilled = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<string>).value);

      expect(fulfilled).toEqual(["value1"]);
    });
  });
});
