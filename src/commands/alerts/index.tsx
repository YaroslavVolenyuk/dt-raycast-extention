import { getPreferenceValues, LocalStorage, showHUD, showToast, Toast } from "@raycast/api";
import { getActiveTenant } from "../../lib/tenants";
import { getAccessToken, invalidateToken } from "../../lib/auth";
import { buildProblemsQuery } from "../../lib/types/problem";

interface Preferences {
  enableAlerts: boolean;
}

const STORAGE_KEY = "dt_last_problem_count";
const HEALTH_KEY = "alerts:last-success";
const WARN_AFTER_MS = 30 * 60_000; // warn after 3 missed ticks (~30 min)

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();
  if (!prefs.enableAlerts) return;
  await checkProblems();
}

async function checkProblems() {
  try {
    const tenant = await getActiveTenant();
    if (!tenant) return;

    const token = await getAccessToken(tenant);
    const endpoint = `${tenant.tenantEndpoint.replace(/\/$/, "")}/platform/storage/query/v1/query:execute`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: buildProblemsQuery("OPEN") }),
    });

    // Invalidate cached token on 401 so next tick fetches fresh
    if (response.status === 401) {
      invalidateToken(tenant.id);
      return;
    }

    if (!response.ok) return;

    const data = (await response.json()) as { result?: { records?: unknown[] } };
    const count = data.result?.records?.length ?? 0;

    const lastStr = await LocalStorage.getItem<string>(STORAGE_KEY + ":" + tenant.id);
    const last = lastStr ? parseInt(lastStr, 10) : 0;

    await LocalStorage.setItem(STORAGE_KEY + ":" + tenant.id, String(count));
    await LocalStorage.setItem(HEALTH_KEY, String(Date.now()));

    if (count > last) {
      const diff = count - last;
      const msg = `${diff} new problem${diff > 1 ? "s" : ""}`;
      await showHUD(`🚨 ${msg}`);
      await showToast({
        style: Toast.Style.Failure,
        title: "New Problems Detected",
        message: msg,
      });
    }
  } catch {
    const lastOkStr = await LocalStorage.getItem<string>(HEALTH_KEY);
    const lastOk = lastOkStr ? Number(lastOkStr) : 0;
    if (lastOk && Date.now() - lastOk > WARN_AFTER_MS) {
      await showHUD("⚠️ Dynatrace alerts can't reach the API — check Manage Tenants");
      // Reset so we don't spam every 5 min
      await LocalStorage.setItem(HEALTH_KEY, String(Date.now()));
    }
  }
}
