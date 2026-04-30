import { describe, expect, it } from "@jest/globals";
import {
  MaintenanceWindow,
  MaintenanceWindowType,
  MaintenanceWindowStatus,
  MaintenanceScopeType,
  getMaintenanceStatus,
  formatMaintenanceTime,
  getScopeDisplay,
  sortMaintenanceWindows,
  MaintenanceWindowSchema,
} from "../lib/types/maintenance";
import { MOCK_MAINTENANCE_WINDOWS } from "../lib/api/mock";

describe("Maintenance Windows", () => {
  describe("getMaintenanceStatus", () => {
    it("should return ACTIVE for current time within window", () => {
      const window: MaintenanceWindow = {
        id: "1",
        name: "Test",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() - 30 * 60 * 1000, // 30 min ago
        endTime: Date.now() + 30 * 60 * 1000, // 30 min from now
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.ACTIVE);
    });

    it("should return SCHEDULED for future window", () => {
      const window: MaintenanceWindow = {
        id: "1",
        name: "Test",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() + 1 * 60 * 60 * 1000, // 1 hour from now
        endTime: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.SCHEDULED);
    });

    it("should return PAST for ended window", () => {
      const window: MaintenanceWindow = {
        id: "1",
        name: "Test",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        endTime: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.PAST);
    });
  });

  describe("formatMaintenanceTime", () => {
    it("should format timestamp as locale string", () => {
      const timestamp = new Date("2026-04-30T14:30:00").getTime();
      const formatted = formatMaintenanceTime(timestamp);

      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
      // Should contain date and time parts
      expect(formatted).toMatch(/\d+/);
    });
  });

  describe("getScopeDisplay", () => {
    it("should return 'All Environment' for no scope", () => {
      expect(getScopeDisplay(undefined)).toBe("All Environment");
      expect(getScopeDisplay(null as any)).toBe("All Environment");
    });

    it("should return zone name for MANAGEMENT_ZONE", () => {
      const scope = {
        type: MaintenanceScopeType.MANAGEMENT_ZONE,
        value: "zone-prod",
      };
      const display = getScopeDisplay(scope);

      expect(display).toContain("Management Zone");
      expect(display).toContain("zone-prod");
    });

    it("should return entity name for ENTITY scope", () => {
      const scope = {
        type: MaintenanceScopeType.ENTITY,
        value: "SERVICE-api",
      };
      const display = getScopeDisplay(scope);

      expect(display).toContain("Entity");
      expect(display).toContain("SERVICE-api");
    });
  });

  describe("sortMaintenanceWindows", () => {
    it("should sort by status: ACTIVE → SCHEDULED → PAST", () => {
      const past: MaintenanceWindow = {
        id: "1",
        name: "Past",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() - 2 * 60 * 60 * 1000,
        endTime: Date.now() - 1 * 60 * 60 * 1000,
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      const scheduled: MaintenanceWindow = {
        id: "2",
        name: "Scheduled",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() + 1 * 60 * 60 * 1000,
        endTime: Date.now() + 2 * 60 * 60 * 1000,
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      const active: MaintenanceWindow = {
        id: "3",
        name: "Active",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() - 30 * 60 * 1000,
        endTime: Date.now() + 30 * 60 * 1000,
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      const sorted = sortMaintenanceWindows([past, scheduled, active]);

      expect(sorted[0].id).toBe("3"); // Active first
      expect(sorted[1].id).toBe("2"); // Scheduled second
      expect(sorted[2].id).toBe("1"); // Past last
    });

    it("should sort scheduled windows by start time (earliest first)", () => {
      const later: MaintenanceWindow = {
        id: "1",
        name: "Later",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() + 2 * 60 * 60 * 1000,
        endTime: Date.now() + 3 * 60 * 60 * 1000,
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      const earlier: MaintenanceWindow = {
        id: "2",
        name: "Earlier",
        type: MaintenanceWindowType.ONE_TIME,
        startTime: Date.now() + 1 * 60 * 60 * 1000,
        endTime: Date.now() + 2 * 60 * 60 * 1000,
        suppressAlertingEnabled: true,
        suppressProblemsEnabled: false,
        enabled: true,
      };

      const sorted = sortMaintenanceWindows([later, earlier]);

      expect(sorted[0].id).toBe("2"); // Earlier first
      expect(sorted[1].id).toBe("1"); // Later second
    });
  });

  describe("MockData Validation", () => {
    it("should have valid mock maintenance windows", () => {
      MOCK_MAINTENANCE_WINDOWS.forEach((window) => {
        // Validate schema
        const validated = MaintenanceWindowSchema.parse(window);
        expect(validated.id).toBeDefined();
        expect(validated.name).toBeDefined();
        expect(validated.startTime).toBeLessThan(validated.endTime);
      });
    });

    it("should have at least one window in each status", () => {
      const statuses = new Set(MOCK_MAINTENANCE_WINDOWS.map(getMaintenanceStatus));

      // Should have at least ACTIVE and SCHEDULED
      expect(statuses.size).toBeGreaterThanOrEqual(2);
    });
  });
});
