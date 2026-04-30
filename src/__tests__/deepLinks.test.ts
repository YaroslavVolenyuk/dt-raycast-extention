// src/__tests__/deepLinks.test.ts
// Unit tests for Deep Links utility

import { describe, it, expect } from "@jest/globals";
import {
  buildDeepLink,
  isSupportedDeepLinkType,
  getSupportedDeepLinkTypes,
  encodeEntityId,
} from "../lib/utils/deepLinks";
import { TenantConfig } from "../lib/auth";

const mockTenant: TenantConfig = {
  id: "test-tenant",
  name: "Test Tenant",
  tenantEndpoint: "https://abc123.live.dynatrace.com",
  clientId: "test-client",
  clientSecret: "test-secret",
  ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
  scopes: ["test:scope"],
};

describe("buildDeepLink", () => {
  it("should build deep link for problem", () => {
    const url = buildDeepLink("problem", "PROBLEM-ABC123", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.problems/problems/PROBLEM-ABC123");
  });

  it("should build deep link for trace", () => {
    const url = buildDeepLink("trace", "TRACE-XYZ789", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.trace.analysis/details/TRACE-XYZ789");
  });

  it("should build deep link for entity", () => {
    const url = buildDeepLink("entity", "SERVICE-abc123", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.entity.explorer/entity/SERVICE-abc123");
  });

  it("should build deep link for SLO", () => {
    const url = buildDeepLink("slo", "slo-payment-99.9", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.slo.details/slo/slo-payment-99.9");
  });

  it("should build deep link for log query", () => {
    const url = buildDeepLink("log-query", "log-query-1", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.log.viewer/logs/log-query-1");
  });

  it("should build deep link for deployment", () => {
    const url = buildDeepLink("deployment", "DEPLOYMENT-001", mockTenant);
    expect(url).toBe(
      "https://abc123.live.dynatrace.com/ui/apps/dynatrace.deployments/deployment/DEPLOYMENT-001",
    );
  });

  it("should build deep link for workflow", () => {
    const url = buildDeepLink("workflow", "workflow-abc123", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/apps/dynatrace.automation/workflow/workflow-abc123");
  });

  it("should build deep link for synthetic monitor", () => {
    const url = buildDeepLink("synthetic", "SYNTHETIC-monitor-1", mockTenant);
    expect(url).toBe(
      "https://abc123.live.dynatrace.com/ui/apps/dynatrace.synthetics/monitors/SYNTHETIC-monitor-1",
    );
  });

  it("should build deep link for settings", () => {
    const url = buildDeepLink("settings", "builtin:ownership.teams", mockTenant);
    expect(url).toBe(
      "https://abc123.live.dynatrace.com/ui/apps/dynatrace.settings/settings/builtin%3Aownership.teams",
    );
  });

  it("should build deep link for maintenance window", () => {
    const url = buildDeepLink("maintenance-window", "maintenance-123", mockTenant);
    expect(url).toBe(
      "https://abc123.live.dynatrace.com/ui/apps/dynatrace.settings/settings/objects/maintenance-123",
    );
  });

  it("should build deep link for metric", () => {
    const url = buildDeepLink("metric", "builtin.host.cpu.usage", mockTenant);
    expect(url).toContain("dynatrace.metric.explorer");
    expect(url).toContain("builtin.host.cpu.usage");
  });

  it("should handle unknown deep link type with fallback", () => {
    const url = buildDeepLink("unknown" as any, "id-123", mockTenant);
    expect(url).toBe("https://abc123.live.dynatrace.com/ui/");
  });

  it("should encode special characters in metric IDs", () => {
    const url = buildDeepLink("metric", "custom.metric(param1,param2)", mockTenant);
    expect(url).toContain("custom.metric%28param1%2Cparam2%29");
  });
});

describe("isSupportedDeepLinkType", () => {
  it("should return true for supported types", () => {
    expect(isSupportedDeepLinkType("problem")).toBe(true);
    expect(isSupportedDeepLinkType("trace")).toBe(true);
    expect(isSupportedDeepLinkType("slo")).toBe(true);
    expect(isSupportedDeepLinkType("workflow")).toBe(true);
  });

  it("should return false for unsupported types", () => {
    expect(isSupportedDeepLinkType("unknown")).toBe(false);
    expect(isSupportedDeepLinkType("invalid")).toBe(false);
  });
});

describe("getSupportedDeepLinkTypes", () => {
  it("should return array of supported types", () => {
    const types = getSupportedDeepLinkTypes();
    expect(types).toContain("problem");
    expect(types).toContain("trace");
    expect(types).toContain("slo");
    expect(types.length).toBeGreaterThan(0);
  });

  it("should include all major entity types", () => {
    const types = getSupportedDeepLinkTypes();
    const required = ["problem", "trace", "entity", "slo", "deployment", "workflow", "synthetic"];
    required.forEach((type) => {
      expect(types).toContain(type);
    });
  });
});

describe("encodeEntityId", () => {
  it("should encode parentheses", () => {
    expect(encodeEntityId("metric(param)")).toBe("metric%28param%29");
  });

  it("should encode quotes", () => {
    expect(encodeEntityId('entity"name')).toContain("%22");
  });

  it("should preserve normal characters", () => {
    expect(encodeEntityId("SERVICE-abc123")).toBe("SERVICE-abc123");
  });

  it("should handle complex entity IDs", () => {
    const complexId = 'metric("value", "name")';
    const encoded = encodeEntityId(complexId);
    expect(encoded).not.toContain('"');
    expect(encoded).not.toContain("(");
  });
});
