/**
 * Tests for src/lib/tenants.ts — CRUD + data integrity.
 */

import { LocalStorage } from "@raycast/api";
import { listTenants, saveTenant, deleteTenant, getActiveTenant, setActiveTenant } from "../lib/tenants";
import type { TenantConfig } from "../lib/auth";

// Reset in-memory LocalStorage mock between tests
const ls = LocalStorage as unknown as { _clear: () => void };

beforeEach(() => {
  ls._clear();
  jest.clearAllMocks();
});

const makeTenant = (id: string): TenantConfig => ({
  id,
  name: `Tenant ${id}`,
  tenantEndpoint: `https://${id}.live.dynatrace.com`,
  clientId: `dt0s02.${id.toUpperCase()}`,
  clientSecret: `dt0s02.${id.toUpperCase()}.SECRET`,
  ssoEndpoint: "https://sso.dynatrace.com/sso/oauth2/token",
  scopes: ["storage:logs:read"],
});

describe("listTenants", () => {
  it("returns [] when storage is empty", async () => {
    const result = await listTenants();
    expect(result).toEqual([]);
  });

  it("returns stored tenants after saving", async () => {
    await saveTenant(makeTenant("t1"));
    await saveTenant(makeTenant("t2"));
    const result = await listTenants();
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("per-item safeParse: one invalid record does not corrupt others", async () => {
    // Write raw JSON with one invalid entry directly
    const good = makeTenant("good");
    const invalid = { id: "", name: "" }; // fails tenantConfigSchema (empty strings)
    await LocalStorage.setItem("tenants:v1", JSON.stringify([good, invalid]));

    const result = await listTenants();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("good");
  });
});

describe("saveTenant / deleteTenant round-trip", () => {
  it("saves and retrieves a tenant", async () => {
    const t = makeTenant("alpha");
    await saveTenant(t);
    const all = await listTenants();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "alpha", name: "Tenant alpha" });
  });

  it("updates an existing tenant (same id)", async () => {
    await saveTenant(makeTenant("beta"));
    const updated = { ...makeTenant("beta"), name: "Updated Beta" };
    await saveTenant(updated);
    const all = await listTenants();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Updated Beta");
  });

  it("deletes a tenant by id", async () => {
    await saveTenant(makeTenant("t1"));
    await saveTenant(makeTenant("t2"));
    await deleteTenant("t1");
    const all = await listTenants();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("t2");
  });

  it("clears the active key when active tenant is deleted", async () => {
    const t = makeTenant("active-one");
    await saveTenant(t);
    await setActiveTenant("active-one");
    await deleteTenant("active-one");
    // After deletion the active key should be gone — getActiveTenant returns null
    const active = await getActiveTenant();
    expect(active).toBeNull();
  });
});

describe("getActiveTenant", () => {
  it("returns null when no tenants stored", async () => {
    const result = await getActiveTenant();
    expect(result).toBeNull();
  });

  it("auto-selects single tenant", async () => {
    await saveTenant(makeTenant("solo"));
    const active = await getActiveTenant();
    expect(active?.id).toBe("solo");
  });

  it("returns the explicitly set active tenant when multiple exist", async () => {
    await saveTenant(makeTenant("first"));
    await saveTenant(makeTenant("second"));
    await setActiveTenant("second");
    const active = await getActiveTenant();
    expect(active?.id).toBe("second");
  });
});
