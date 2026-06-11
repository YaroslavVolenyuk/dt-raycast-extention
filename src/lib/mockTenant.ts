// src/lib/mockTenant.ts
// Utility for initializing a dummy tenant in mock mode.
// This allows all commands to work with mock data without requiring OAuth setup.

import { isMockMode } from "./devMode";
import type { TenantConfig } from "./auth";

// ── Mock tenant list (used by listTenants in mock mode) ────────────────────────

export const MOCK_TENANTS: TenantConfig[] = [
  {
    id: "mock-prod",
    name: "Production (Mock)",
    tenantEndpoint: "https://prod.live.dynatrace.com",
    clientId: "dt0s02.MOCK_PROD_ID",
    clientSecret: "dt0s02.MOCK_PROD_SECRET.XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
    scopes: ["storage:logs:read", "storage:problems:read", "entity:read"],
  },
  {
    id: "mock-dev",
    name: "Development (Mock)",
    tenantEndpoint: "https://dev.live.dynatrace.com",
    clientId: "dt0s02.MOCK_DEV_ID",
    clientSecret: "dt0s02.MOCK_DEV_SECRET.XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
    scopes: ["storage:logs:read", "storage:problems:read", "entity:read"],
  },
  {
    id: "mock-staging",
    name: "Staging (Mock)",
    tenantEndpoint: "https://staging.live.dynatrace.com",
    clientId: "dt0s02.MOCK_STAGING_ID",
    clientSecret: "dt0s02.MOCK_STAGING_SECRET.XXXXXXXXXXXXXXXXXXXXXXXX",
    ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
    scopes: ["storage:logs:read", "storage:problems:read", "entity:read"],
  },
];

/**
 * Create a dummy tenant for mock mode development.
 * Use this when getActiveTenant() returns null but mock mode is enabled.
 */
export function createMockTenant(): TenantConfig {
  return {
    id: "mock-mode",
    name: "Mock Mode (Sample Data)",
    tenantEndpoint: "https://mock.dynatrace.local",
    clientId: "mock-client",
    clientSecret: "mock-secret",
    ssoEndpoint: "https://mock.sso.local",
    scopes: ["mock"],
  };
}

/**
 * Get active tenant or create a mock one if in mock mode.
 * Combines getActiveTenant() logic with mock mode fallback.
 *
 * Usage:
 *  const tenant = await getActiveTenantOrMock();
 *  // tenant is always non-null if in mock mode
 */
export async function getActiveTenantOrMock(
  getActiveTenantFn: () => Promise<TenantConfig | null>,
): Promise<TenantConfig | null> {
  const active = await getActiveTenantFn();

  // In mock mode, return dummy tenant if no real tenant configured
  if (isMockMode() && !active) {
    return createMockTenant();
  }

  return active;
}

/**
 * Check if we should show empty tenant state.
 * Returns false if in mock mode (mock tenant handles it).
 */
export function shouldShowEmptyTenantState(hasRealTenant: boolean): boolean {
  // Show empty state only if:
  // - No real tenant configured AND
  // - NOT in mock mode (mock mode has its own dummy tenant)
  return !hasRealTenant && !isMockMode();
}
