import { describe, expect, it } from "@jest/globals";
import {
  MaintenanceWindow,
  MaintenanceWindowStatus,
  getMaintenanceStatus,
  formatMaintenanceTime,
  getScopeDisplay,
  getSuppressionDisplay,
  sortMaintenanceWindows,
  MaintenanceWindowSchema,
} from "../lib/types/maintenance";
import {
  buildCreateMaintenancePayload,
  settingsItemToMaintenanceWindow,
  settingsObjectsResponseSchema,
  MAINTENANCE_SCHEMA_ID,
} from "../lib/api/maintenance";
import { MOCK_MAINTENANCE_WINDOWS } from "../lib/api/mock";

function makeWindow(overrides: Partial<MaintenanceWindow>): MaintenanceWindow {
  return {
    id: "1",
    name: "Test",
    maintenanceType: "PLANNED",
    scheduleType: "ONCE",
    suppression: "DETECT_PROBLEMS_DONT_ALERT",
    startTime: Date.now() - 30 * 60 * 1000,
    endTime: Date.now() + 30 * 60 * 1000,
    enabled: true,
    ...overrides,
  };
}

describe("Maintenance Windows", () => {
  describe("getMaintenanceStatus", () => {
    it("should return ACTIVE for current time within window", () => {
      expect(getMaintenanceStatus(makeWindow({}))).toBe(MaintenanceWindowStatus.ACTIVE);
    });

    it("should return SCHEDULED for future window", () => {
      const window = makeWindow({
        startTime: Date.now() + 1 * 60 * 60 * 1000,
        endTime: Date.now() + 2 * 60 * 60 * 1000,
      });
      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.SCHEDULED);
    });

    it("should return PAST for ended window", () => {
      const window = makeWindow({
        startTime: Date.now() - 2 * 60 * 60 * 1000,
        endTime: Date.now() - 1 * 60 * 60 * 1000,
      });
      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.PAST);
    });

    it("should return SCHEDULED for windows without resolvable times", () => {
      const window = makeWindow({ startTime: undefined, endTime: undefined, scheduleType: "WEEKLY" });
      expect(getMaintenanceStatus(window)).toBe(MaintenanceWindowStatus.SCHEDULED);
    });
  });

  describe("formatMaintenanceTime", () => {
    it("should format timestamp as locale string", () => {
      const formatted = formatMaintenanceTime(new Date("2026-04-30T14:30:00").getTime());
      expect(typeof formatted).toBe("string");
      expect(formatted).toMatch(/\d+/);
    });

    it("should return em dash for missing timestamp", () => {
      expect(formatMaintenanceTime(undefined)).toBe("—");
    });
  });

  describe("getScopeDisplay", () => {
    it("should return 'All Environment' for no filters", () => {
      expect(getScopeDisplay(undefined)).toBe("All Environment");
      expect(getScopeDisplay([])).toBe("All Environment");
    });

    it("should display management zones", () => {
      const display = getScopeDisplay([{ managementZones: ["zone-prod"] }]);
      expect(display).toContain("Management Zones");
      expect(display).toContain("zone-prod");
    });

    it("should display entity id", () => {
      const display = getScopeDisplay([{ entityId: "SERVICE-api" }]);
      expect(display).toContain("Entity");
      expect(display).toContain("SERVICE-api");
    });
  });

  describe("getSuppressionDisplay", () => {
    it("maps all suppression modes", () => {
      expect(getSuppressionDisplay("DETECT_PROBLEMS_AND_ALERT")).toContain("alert");
      expect(getSuppressionDisplay("DETECT_PROBLEMS_DONT_ALERT")).toContain("don't alert");
      expect(getSuppressionDisplay("DONT_DETECT_PROBLEMS")).toContain("detect");
    });
  });

  describe("sortMaintenanceWindows", () => {
    it("should sort by status: ACTIVE → SCHEDULED → PAST", () => {
      const past = makeWindow({
        id: "1",
        startTime: Date.now() - 2 * 60 * 60 * 1000,
        endTime: Date.now() - 1 * 60 * 60 * 1000,
      });
      const scheduled = makeWindow({
        id: "2",
        startTime: Date.now() + 1 * 60 * 60 * 1000,
        endTime: Date.now() + 2 * 60 * 60 * 1000,
      });
      const active = makeWindow({ id: "3" });

      const sorted = sortMaintenanceWindows([past, scheduled, active]);
      expect(sorted.map((w) => w.id)).toEqual(["3", "2", "1"]);
    });

    it("should sort scheduled windows by start time (earliest first)", () => {
      const later = makeWindow({
        id: "1",
        startTime: Date.now() + 2 * 60 * 60 * 1000,
        endTime: Date.now() + 3 * 60 * 60 * 1000,
      });
      const earlier = makeWindow({
        id: "2",
        startTime: Date.now() + 1 * 60 * 60 * 1000,
        endTime: Date.now() + 2 * 60 * 60 * 1000,
      });

      const sorted = sortMaintenanceWindows([later, earlier]);
      expect(sorted.map((w) => w.id)).toEqual(["2", "1"]);
    });
  });

  describe("Settings 2.0 contract", () => {
    it("parses a settings/objects list response shape", () => {
      const response = {
        items: [
          {
            objectId: "abc",
            value: {
              enabled: true,
              generalProperties: {
                name: "DB upgrade",
                maintenanceType: "PLANNED",
                suppression: "DONT_DETECT_PROBLEMS",
              },
              schedule: {
                scheduleType: "ONCE",
                onceRecurrence: {
                  startTime: "2026-06-12T02:00:00",
                  endTime: "2026-06-12T03:00:00",
                  timeZone: "UTC",
                },
              },
            },
          },
        ],
        totalCount: 1,
        pageSize: 100,
      };
      const parsed = settingsObjectsResponseSchema.parse(response);
      expect(parsed.items).toHaveLength(1);

      const mapped = settingsItemToMaintenanceWindow(parsed.items[0]);
      expect(mapped).not.toBeNull();
      expect(mapped!.id).toBe("abc");
      expect(mapped!.name).toBe("DB upgrade");
      expect(mapped!.suppression).toBe("DONT_DETECT_PROBLEMS");
      expect(mapped!.startTime).toBeLessThan(mapped!.endTime!);
    });

    it("returns null (not throw) for malformed values", () => {
      expect(settingsItemToMaintenanceWindow({ objectId: "x", value: { name: "flat-legacy-shape" } })).toBeNull();
    });

    it("builds the create payload as an ARRAY with schemaId and scope", () => {
      const payload = buildCreateMaintenancePayload({
        name: "Test window",
        maintenanceType: "PLANNED",
        suppression: "DETECT_PROBLEMS_DONT_ALERT",
        startTime: "2026-06-12T02:00:00",
        endTime: "2026-06-12T03:00:00",
        timeZone: "Europe/Berlin",
        managementZone: "zone-1",
      });

      expect(Array.isArray(payload)).toBe(true);
      expect(payload).toHaveLength(1);
      const obj = payload[0] as Record<string, unknown>;
      expect(obj.schemaId).toBe(MAINTENANCE_SCHEMA_ID);
      expect(obj.scope).toBe("environment");

      const value = obj.value as Record<string, unknown>;
      // No flat legacy fields like startTime/type at the top of value
      expect(value.startTime).toBeUndefined();
      expect(value.type).toBeUndefined();

      const general = value.generalProperties as Record<string, unknown>;
      expect(general.name).toBe("Test window");
      expect(general.maintenanceType).toBe("PLANNED");
      expect(general.suppression).toBe("DETECT_PROBLEMS_DONT_ALERT");

      const schedule = value.schedule as Record<string, unknown>;
      expect(schedule.scheduleType).toBe("ONCE");
      const once = schedule.onceRecurrence as Record<string, unknown>;
      expect(once.startTime).toBe("2026-06-12T02:00:00");
      expect(once.timeZone).toBe("Europe/Berlin");

      expect(value.filters).toEqual([{ managementZones: ["zone-1"] }]);
    });

    it("omits filters for environment-wide windows", () => {
      const payload = buildCreateMaintenancePayload({
        name: "Env window",
        maintenanceType: "UNPLANNED",
        suppression: "DETECT_PROBLEMS_AND_ALERT",
        startTime: "2026-06-12T02:00:00",
        endTime: "2026-06-12T03:00:00",
        timeZone: "UTC",
      });
      const value = (payload[0] as Record<string, unknown>).value as Record<string, unknown>;
      expect(value.filters).toBeUndefined();
    });
  });

  describe("MockData Validation", () => {
    it("should have valid mock maintenance windows", () => {
      MOCK_MAINTENANCE_WINDOWS.forEach((window) => {
        const validated = MaintenanceWindowSchema.parse(window);
        expect(validated.id).toBeDefined();
        expect(validated.name).toBeDefined();
        if (validated.startTime != null && validated.endTime != null) {
          expect(validated.startTime).toBeLessThan(validated.endTime);
        }
      });
    });

    it("should have at least one window in each status", () => {
      const statuses = new Set(MOCK_MAINTENANCE_WINDOWS.map(getMaintenanceStatus));
      expect(statuses.size).toBeGreaterThanOrEqual(2);
    });
  });
});
