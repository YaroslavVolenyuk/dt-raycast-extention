// src/__tests__/settings.test.ts
import {
  settingsObjectSchema,
  settingsListSchema,
  getSettingsTypeLabel,
  getSettingsTypeIcon,
  SETTINGS_TYPES,
} from "../lib/types/settings";
import { MOCK_SETTINGS } from "../lib/api/mock";

describe("Settings Types & Validation", () => {
  test("should validate settings object schema", () => {
    const setting = {
      id: "test-001",
      schemaId: "builtin:alerting.profile",
      objectId: "alert-obj-001",
      displayName: "Test Alert Profile",
      value: {},
    };

    const result = settingsObjectSchema.safeParse(setting);
    expect(result.success).toBe(true);
  });

  test("should reject invalid schema ID", () => {
    const setting = {
      id: "test-001",
      schemaId: "invalid:schema",
      objectId: "alert-obj-001",
      displayName: "Test Alert Profile",
      value: {},
    };

    const result = settingsObjectSchema.safeParse(setting);
    expect(result.success).toBe(false);
  });

  test("should validate settings list schema", () => {
    const result = settingsListSchema.safeParse(MOCK_SETTINGS);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(MOCK_SETTINGS.length);
  });

  test("should return correct labels for schema types", () => {
    expect(getSettingsTypeLabel("builtin:alerting.profile")).toBe("Alerting Profiles");
    expect(getSettingsTypeLabel("builtin:management-zones")).toBe("Management Zones");
    expect(getSettingsTypeLabel("builtin:tags.auto-tagging")).toBe("Auto-Tags");
    expect(getSettingsTypeLabel("builtin:maintenance-window")).toBe("Maintenance Windows");
  });

  test("should return correct icons for schema types", () => {
    expect(getSettingsTypeIcon("builtin:alerting.profile")).toBe("🔔");
    expect(getSettingsTypeIcon("builtin:management-zones")).toBe("🎯");
    expect(getSettingsTypeIcon("builtin:tags.auto-tagging")).toBe("🏷️");
    expect(getSettingsTypeIcon("builtin:maintenance-window")).toBe("🛠️");
  });

  test("should have all settings types defined", () => {
    expect(SETTINGS_TYPES.length).toBeGreaterThan(0);
    for (const type of SETTINGS_TYPES) {
      expect(type.id).toBeDefined();
      expect(type.label).toBeDefined();
      expect(type.description).toBeDefined();
      expect(type.icon).toBeDefined();
    }
  });
});

describe("Mock Settings Data", () => {
  test("should have minimum 4 settings objects", () => {
    expect(MOCK_SETTINGS.length).toBeGreaterThanOrEqual(4);
  });

  test("should have variety of schema types", () => {
    const schemaIds = new Set(MOCK_SETTINGS.map((s) => s.schemaId));
    expect(schemaIds.size).toBeGreaterThan(1);
  });

  test("should have valid object IDs", () => {
    for (const setting of MOCK_SETTINGS) {
      expect(setting.objectId).toBeDefined();
      expect(setting.objectId.length).toBeGreaterThan(0);
    }
  });

  test("should have display names", () => {
    for (const setting of MOCK_SETTINGS) {
      expect(setting.displayName).toBeDefined();
      expect(setting.displayName.length).toBeGreaterThan(0);
    }
  });

  test("should have JSON value objects", () => {
    for (const setting of MOCK_SETTINGS) {
      expect(setting.value).toBeDefined();
      expect(typeof setting.value).toBe("object");
    }
  });

  test("should have scope information", () => {
    const withScope = MOCK_SETTINGS.filter((s) => s.scope);
    expect(withScope.length).toBeGreaterThan(0);
  });

  test("should have author information", () => {
    const withAuthor = MOCK_SETTINGS.filter((s) => s.author);
    expect(withAuthor.length).toBeGreaterThan(0);
  });

  test("should have timestamps", () => {
    for (const setting of MOCK_SETTINGS) {
      if (setting.createdAt) {
        expect(() => new Date(setting.createdAt!)).not.toThrow();
      }
      if (setting.modifiedAt) {
        expect(() => new Date(setting.modifiedAt!)).not.toThrow();
      }
    }
  });
});

describe("Settings Filtering & Search", () => {
  test("should filter settings by schema type", () => {
    const alertingSettings = MOCK_SETTINGS.filter((s) => s.schemaId === "builtin:alerting.profile");
    expect(alertingSettings.length).toBeGreaterThan(0);
  });

  test("should filter settings by scope", () => {
    const envSettings = MOCK_SETTINGS.filter((s) => s.scope === "ENVIRONMENT");
    expect(envSettings.length).toBeGreaterThan(0);
  });

  test("should search by display name", () => {
    const name = "Alerting";
    const found = MOCK_SETTINGS.filter((s) => s.displayName.includes(name));
    expect(found.length).toBeGreaterThan(0);
  });

  test("should handle case-insensitive search", () => {
    const name = "alert";
    const found = MOCK_SETTINGS.filter((s) => s.displayName.toLowerCase().includes(name.toLowerCase()));
    expect(found.length).toBeGreaterThan(0);
  });

  test("should group settings by schema type", () => {
    const grouped = new Map<string, typeof MOCK_SETTINGS>();
    for (const setting of MOCK_SETTINGS) {
      if (!grouped.has(setting.schemaId)) {
        grouped.set(setting.schemaId, []);
      }
      grouped.get(setting.schemaId)!.push(setting);
    }

    expect(grouped.size).toBeGreaterThan(0);
    for (const items of grouped.values()) {
      expect(items.length).toBeGreaterThan(0);
    }
  });
});

describe("Settings Value JSON", () => {
  test("should have valid JSON structure", () => {
    for (const setting of MOCK_SETTINGS) {
      const jsonStr = JSON.stringify(setting.value);
      expect(() => JSON.parse(jsonStr)).not.toThrow();
    }
  });

  test("should be copyable as JSON", () => {
    for (const setting of MOCK_SETTINGS) {
      const jsonStr = JSON.stringify(setting.value, null, 2);
      expect(jsonStr.length).toBeGreaterThan(0);
      expect(jsonStr).toContain("{");
    }
  });

  test("alerting profile should have rules and notifications", () => {
    const alerting = MOCK_SETTINGS.find((s) => s.schemaId === "builtin:alerting.profile");
    if (alerting) {
      const value = alerting.value as Record<string, unknown>;
      expect(value.filters || value.rules || value.name).toBeDefined();
    }
  });

  test("management zone should have zone rules", () => {
    const mz = MOCK_SETTINGS.find((s) => s.schemaId === "builtin:management-zones");
    if (mz) {
      const value = mz.value as Record<string, unknown>;
      expect(value.rules || value.name).toBeDefined();
    }
  });
});

describe("Settings Metadata", () => {
  test("should track modification status", () => {
    for (const setting of MOCK_SETTINGS) {
      expect(setting.isModified).toBeDefined();
      expect(typeof setting.isModified).toBe("boolean");
    }
  });

  test("should have version information", () => {
    const withVersion = MOCK_SETTINGS.filter((s) => s.schemaVersion);
    expect(withVersion.length).toBeGreaterThan(0);
  });

  test("should maintain object ID uniqueness", () => {
    const ids = MOCK_SETTINGS.map((s) => s.objectId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("should have consistent schema ID and type label", () => {
    for (const setting of MOCK_SETTINGS) {
      const label = getSettingsTypeLabel(setting.schemaId);
      expect(label).not.toBe(setting.schemaId); // Should get human-readable label
    }
  });
});
