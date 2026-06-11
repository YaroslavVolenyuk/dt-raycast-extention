// src/lib/utils/deepLinks.ts
// Build deep links to Dynatrace UI for various entity types

import { TenantConfig } from "../auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeepLinkType =
  | "problem"
  | "trace"
  | "entity"
  | "log-query"
  | "slo"
  | "deployment"
  | "workflow"
  | "synthetic"
  | "settings"
  | "maintenance-window"
  | "metric"
  | "host"
  | "service"
  | "extension"
  | "breakpoint";

interface DeepLinkConfig {
  appId: string;
  pathPattern: (id: string) => string;
}

// ── Helper: Encode Entity ID for URLs ────────────────────────────────────────

/**
 * Encode special characters in entity IDs for URL safety
 * @param id - Entity ID that may contain special characters
 * @returns Properly encoded ID for use in URLs
 */
function encodeEntityIdForUrl(id: string): string {
  return encodeURIComponent(id).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27").replace(/"/g, "%22");
}

// ── App ID Mappings ──────────────────────────────────────────────────────────

const DEEP_LINK_CONFIG: Record<DeepLinkType, DeepLinkConfig> = {
  problem: {
    appId: "dynatrace.problems",
    pathPattern: (id) => `/problems/${encodeEntityIdForUrl(id)}`,
  },
  trace: {
    appId: "dynatrace.trace.analysis",
    pathPattern: (id) => `/details/${encodeEntityIdForUrl(id)}`,
  },
  entity: {
    appId: "dynatrace.entity.explorer",
    pathPattern: (id) => `/entity/${encodeEntityIdForUrl(id)}`,
  },
  "log-query": {
    appId: "dynatrace.log.viewer",
    pathPattern: (id) => `/logs/${encodeEntityIdForUrl(id)}`,
  },
  slo: {
    appId: "dynatrace.slo.details",
    pathPattern: (id) => `/slo/${encodeEntityIdForUrl(id)}`,
  },
  deployment: {
    appId: "dynatrace.deployments",
    pathPattern: (id) => `/deployment/${encodeEntityIdForUrl(id)}`,
  },
  workflow: {
    appId: "dynatrace.automation",
    pathPattern: (id) => `/workflow/${encodeEntityIdForUrl(id)}`,
  },
  synthetic: {
    appId: "dynatrace.synthetics",
    pathPattern: (id) => `/monitors/${encodeEntityIdForUrl(id)}`,
  },
  settings: {
    appId: "dynatrace.settings",
    pathPattern: (id) => `/settings/${encodeEntityIdForUrl(id)}`,
  },
  "maintenance-window": {
    appId: "dynatrace.settings",
    pathPattern: (id) => `/settings/objects/${encodeEntityIdForUrl(id)}`,
  },
  metric: {
    appId: "dynatrace.metric.explorer",
    pathPattern: (id) => `/metrics/${encodeEntityIdForUrl(id)}`,
  },
  host: {
    appId: "dynatrace.entity.explorer",
    pathPattern: (id) => `/entity/${encodeEntityIdForUrl(id)}`,
  },
  service: {
    appId: "dynatrace.entity.explorer",
    pathPattern: (id) => `/entity/${encodeEntityIdForUrl(id)}`,
  },
  extension: {
    appId: "dynatrace.extensions",
    pathPattern: (id) => `/extension/${encodeEntityIdForUrl(id)}`,
  },
  breakpoint: {
    appId: "dynatrace.debugger",
    pathPattern: (id) => `/breakpoint/${encodeEntityIdForUrl(id)}`,
  },
};

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Build a deep link to a Dynatrace UI page
 *
 * @param type - Type of entity (problem, trace, entity, log-query, slo, deployment, etc.)
 * @param id - Entity ID (problem ID, trace ID, entity ID, etc.)
 * @param tenant - Tenant configuration (for tenantEndpoint)
 * @returns Full URL to open in browser
 *
 * @example
 * const url = buildDeepLink("problem", "PROBLEM-ABC123", tenant);
 * // Returns: https://abc123.live.dynatrace.com/ui/apps/dynatrace.problems/problems/PROBLEM-ABC123
 *
 * @example
 * const url = buildDeepLink("slo", "slo-payment-99.9", tenant);
 * // Returns: https://abc123.live.dynatrace.com/ui/apps/dynatrace.slo.details/slo/slo-payment-99.9
 */
export function buildDeepLink(type: DeepLinkType, id: string, tenant: TenantConfig): string {
  // Get app ID and path pattern, or use fallback
  const config = DEEP_LINK_CONFIG[type];

  if (!config) {
    // Fallback: return to main Dynatrace UI
    return `${tenant.tenantEndpoint}/ui/`;
  }

  const path = config.pathPattern(id);
  return `${tenant.tenantEndpoint}/ui/apps/${config.appId}${path}`;
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Check if a deep link type is supported
 */
export function isSupportedDeepLinkType(type: string): type is DeepLinkType {
  return type in DEEP_LINK_CONFIG;
}

/**
 * Get all supported deep link types
 */
export function getSupportedDeepLinkTypes(): DeepLinkType[] {
  return Object.keys(DEEP_LINK_CONFIG) as DeepLinkType[];
}

/**
 * Encode special characters in entity IDs for URL safety (exported for testing)
 * @param id - Entity ID that may contain special characters
 * @returns Properly encoded ID for use in URLs
 */
export function encodeEntityId(id: string): string {
  return encodeEntityIdForUrl(id);
}

// ── Examples ──────────────────────────────────────────────────────────────────

/**
 * Example usage of buildDeepLink
 */
export function examples(tenant: TenantConfig): Record<DeepLinkType, string> {
  return {
    problem: buildDeepLink("problem", "PROBLEM-ABC123", tenant),
    trace: buildDeepLink("trace", "TRACE-XYZ789", tenant),
    entity: buildDeepLink("entity", "SERVICE-abc123def", tenant),
    "log-query": buildDeepLink("log-query", "log-query-1", tenant),
    slo: buildDeepLink("slo", "slo-payment-service", tenant),
    deployment: buildDeepLink("deployment", "DEPLOYMENT-001", tenant),
    workflow: buildDeepLink("workflow", "workflow-abc123", tenant),
    synthetic: buildDeepLink("synthetic", "SYNTHETIC-monitor-1", tenant),
    settings: buildDeepLink("settings", "builtin:ownership.teams", tenant),
    "maintenance-window": buildDeepLink("maintenance-window", "maintenance-123", tenant),
    metric: buildDeepLink("metric", "builtin.host.cpu.usage", tenant),
    host: buildDeepLink("host", "HOST-abc123def", tenant),
    service: buildDeepLink("service", "SERVICE-xyz789", tenant),
    extension: buildDeepLink("extension", "ext-kubernetes", tenant),
    breakpoint: buildDeepLink("breakpoint", "breakpoint-1", tenant),
  };
}
