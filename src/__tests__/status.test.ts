import { describe, expect, it } from "@jest/globals";
import {
  StatusSnapshot,
  getDashboardSeverity,
  hasIssues,
  formatLastChecked,
  countAvailabilityProblems,
  countFailingMonitors,
} from "../lib/types/status";
import type { Problem } from "../lib/types/problem";
import type { SyntheticMonitorData } from "../lib/types/synthetic";
import { ExecutionStatus, MonitorType } from "../lib/types/synthetic";

function makeProblem(category: string): Problem {
  return {
    "event.id": "P-1",
    "event.name": "Test problem",
    "event.status": "OPEN",
    "event.category": category,
    "event.severity": "3",
    "event.start": new Date().toISOString(),
  };
}

function makeMonitor(failed: boolean): SyntheticMonitorData {
  return {
    monitor: {
      monitorId: "SYNTHETIC_TEST-1",
      name: "Test monitor",
      type: MonitorType.HTTP,
      url: "https://example.com",
      enabled: true,
      locations: ["Frankfurt"],
    },
    lastExecution: failed
      ? {
          executionId: "e1",
          monitorId: "SYNTHETIC_TEST-1",
          timestamp: Date.now(),
          status: ExecutionStatus.FAILED,
          locationResults: [],
        }
      : undefined,
  };
}

function snapshot(partial: Partial<StatusSnapshot>): StatusSnapshot {
  return {
    lastChecked: Date.now(),
    problems: [],
    synthetics: [],
    ...partial,
  };
}

describe("Status Dashboard", () => {
  describe("getDashboardSeverity", () => {
    it("returns 'healthy' when all sources loaded and clean", () => {
      expect(getDashboardSeverity(snapshot({}))).toBe("healthy");
    });

    it("returns 'critical' when AVAILABILITY problems exist", () => {
      expect(getDashboardSeverity(snapshot({ problems: [makeProblem("AVAILABILITY")] }))).toBe("critical");
    });

    it("returns 'warning' for non-availability problems", () => {
      expect(getDashboardSeverity(snapshot({ problems: [makeProblem("SLOWDOWN")] }))).toBe("warning");
    });

    it("returns 'warning' when synthetics are failing", () => {
      expect(getDashboardSeverity(snapshot({ synthetics: [makeMonitor(true)] }))).toBe("warning");
    });

    it("returns 'unknown' (not healthy) when a data source is unavailable", () => {
      expect(getDashboardSeverity(snapshot({ problems: null }))).toBe("unknown");
      expect(getDashboardSeverity(snapshot({ synthetics: null }))).toBe("unknown");
    });

    it("still reports issues from available sources when another is down", () => {
      expect(getDashboardSeverity(snapshot({ problems: [makeProblem("AVAILABILITY")], synthetics: null }))).toBe(
        "critical",
      );
    });
  });

  describe("counters", () => {
    it("counts availability problems by event.category", () => {
      const problems = [makeProblem("AVAILABILITY"), makeProblem("ERROR"), makeProblem("AVAILABILITY")];
      expect(countAvailabilityProblems(problems)).toBe(2);
    });

    it("does not count monitors without execution data as failing", () => {
      expect(countFailingMonitors([makeMonitor(false), makeMonitor(true)])).toBe(1);
    });
  });

  describe("hasIssues", () => {
    it("returns true when problems exist", () => {
      expect(hasIssues(snapshot({ problems: [makeProblem("ERROR")] }))).toBe(true);
    });

    it("returns true when synthetics failing", () => {
      expect(hasIssues(snapshot({ synthetics: [makeMonitor(true)] }))).toBe(true);
    });

    it("returns false when all healthy", () => {
      expect(hasIssues(snapshot({}))).toBe(false);
    });
  });

  describe("formatLastChecked", () => {
    it("should return 'just now' for recent timestamp", () => {
      expect(formatLastChecked(Date.now())).toBe("just now");
    });

    it("should return minute-based format", () => {
      expect(formatLastChecked(Date.now() - 5 * 60 * 1000)).toBe("5 min ago");
    });

    it("should return '1 min ago' for exactly 1 minute", () => {
      expect(formatLastChecked(Date.now() - 60 * 1000)).toBe("1 min ago");
    });

    it("should return hour-based format", () => {
      expect(formatLastChecked(Date.now() - 2 * 60 * 60 * 1000)).toBe("2 hours ago");
    });

    it("should return '1 hour ago' for exactly 1 hour", () => {
      expect(formatLastChecked(Date.now() - 60 * 60 * 1000)).toBe("1 hour ago");
    });

    it("should return day-based format", () => {
      expect(formatLastChecked(Date.now() - 2 * 24 * 60 * 60 * 1000)).toMatch(/\d+ day ago/);
    });
  });
});
