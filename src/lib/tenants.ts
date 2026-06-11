// src/lib/tenants.ts
// CRUD operations for Dynatrace tenant configurations.
// Data is stored in Raycast LocalStorage (non-synced, plaintext on disk — NOT encrypted).
// clientSecret stored here is accessible to anyone with filesystem access to the machine.
// Access tokens are held in-memory only (see auth.ts) and never written to disk.

import { LocalStorage } from "@raycast/api";
import { z } from "zod";
import { isMockMode } from "./devMode";
import { MOCK_TENANTS } from "./mockTenant";
import type { TenantConfig } from "./auth";

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "tenants:v1";
const ACTIVE_KEY = "tenants:active";

// ── Zod schema ────────────────────────────────────────────────────────────────

export const tenantConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tenantEndpoint: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  ssoEndpoint: z.string().url(),
  scopes: z.array(z.string()),
  accountUrn: z.string().optional(),
  useClassicProxy: z.boolean().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readAll(): Promise<TenantConfig[]> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // Per-item safeParse: one corrupted entry does not wipe the rest
    const items: TenantConfig[] = [];
    for (const item of Array.isArray(parsed) ? parsed : []) {
      const result = tenantConfigSchema.safeParse(item);
      if (result.success) items.push(result.data);
    }
    return items;
  } catch {
    // Raw key exists but can't be parsed at all — do NOT silently return []
    // (returning [] would cause the next saveTenant to overwrite all data)
    throw new Error("Tenant storage is corrupted. Please reset via Manage Tenants.");
  }
}

async function writeAll(tenants: TenantConfig[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(tenants));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listTenants(): Promise<TenantConfig[]> {
  const stored = await readAll();
  // In mock mode with no real tenants stored, return the built-in mock list
  if (isMockMode() && stored.length === 0) return MOCK_TENANTS;
  return stored;
}

export async function saveTenant(tenant: TenantConfig): Promise<void> {
  // readAll throws if storage is corrupted — do NOT overwrite in that case
  const tenants = await readAll();
  const idx = tenants.findIndex((t) => t.id === tenant.id);
  if (idx >= 0) {
    tenants[idx] = tenant;
  } else {
    tenants.push(tenant);
  }
  await writeAll(tenants);
}

export async function deleteTenant(id: string): Promise<void> {
  const tenants = await readAll();
  await writeAll(tenants.filter((t) => t.id !== id));

  // Clear active if deleted
  const activeId = await LocalStorage.getItem<string>(ACTIVE_KEY);
  if (activeId === id) {
    await LocalStorage.removeItem(ACTIVE_KEY);
  }
}

export async function getActiveTenant(): Promise<TenantConfig | null> {
  const tenants = await listTenants();
  if (tenants.length === 0) return null;

  // In mock mode, prefer "Production (Mock)" if available
  if (isMockMode()) {
    const mockProd = tenants.find((t) => t.id === "mock-prod");
    if (mockProd) return mockProd;
  }

  const activeId = await LocalStorage.getItem<string>(ACTIVE_KEY);
  if (activeId) {
    const found = tenants.find((t) => t.id === activeId);
    if (found) return found;
    // Active ID points to a deleted tenant — clean up dangling ref
    await LocalStorage.removeItem(ACTIVE_KEY);
  }

  // Exactly one tenant: auto-select it without silently switching in multi-tenant setups
  if (tenants.length === 1) {
    await LocalStorage.setItem(ACTIVE_KEY, tenants[0].id);
    return tenants[0];
  }

  // Multiple tenants and no active selection — require explicit choice
  return null;
}

export async function setActiveTenant(id: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_KEY, id);
}
