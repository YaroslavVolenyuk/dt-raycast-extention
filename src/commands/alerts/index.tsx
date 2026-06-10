import { getPreferenceValues, LocalStorage, showHUD } from "@raycast/api";
import { getActiveTenant } from "../../lib/tenants";
import { executeDqlQuery } from "../../lib/api/grail";
import { buildProblemsQuery } from "../../lib/types/problem";
import { StorageKeys } from "../../lib/storageKeys";

interface Preferences {
  enableAlerts: boolean;
}

const WARN_AFTER_MS = 30 * 60_000; // warn after 3 missed ticks (~30 min)
const IN_FLIGHT_TTL_MS = 20_000; // consider a previous tick stale after 20 s

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();
  if (!prefs.enableAlerts) return;
  await checkProblems();
}

async function checkProblems() {
  // In-flight guard: prevent two overlapping ticks (rare, but possible)
  const lastStartStr = await LocalStorage.getItem<string>(StorageKeys.alertsLastRunStart);
  const lastStart = lastStartStr ? Number(lastStartStr) : 0;
  if (Date.now() - lastStart < IN_FLIGHT_TTL_MS) return;
  await LocalStorage.setItem(StorageKeys.alertsLastRunStart, String(Date.now()));

  try {
    const tenant = await getActiveTenant();
    if (!tenant) return;

    const records = await executeDqlQuery(tenant, buildProblemsQuery("OPEN"), { timeoutMs: 15_000 });
    const count = records.length;

    const lastStr = await LocalStorage.getItem<string>(StorageKeys.lastProblemCount(tenant.id));
    const last = lastStr ? parseInt(lastStr, 10) : 0;

    await LocalStorage.setItem(StorageKeys.lastProblemCount(tenant.id), String(count));
    await LocalStorage.setItem(StorageKeys.alertsLastSuccess, String(Date.now()));

    if (count > last) {
      const diff = count - last;
      await showHUD(`🚨 ${diff} new problem${diff > 1 ? "s" : ""}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    const lastOkStr = await LocalStorage.getItem<string>(StorageKeys.alertsLastSuccess);
    const lastOk = lastOkStr ? Number(lastOkStr) : 0;
    if (lastOk && Date.now() - lastOk > WARN_AFTER_MS) {
      await showHUD("⚠️ Dynatrace alerts can't reach the API — check Manage Tenants");
      // Reset timer so we don't spam every 5 min
      await LocalStorage.setItem(StorageKeys.alertsLastSuccess, String(Date.now()));
    }
  }
}
