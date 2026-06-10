// Dynatrace Grail query hook — React wrapper around executeDqlQuery.
// Non-React contexts (alerts, background commands) use executeDqlQuery directly.

import { useCallback, useEffect, useState, useRef } from "react";
import { showToast, Toast } from "@raycast/api";
import { MOCK_LOGS, MOCK_PROBLEMS, MOCK_DEPLOYMENTS, MOCK_SPANS, MOCK_ENTITIES } from "./api/mock";
import { LogRecord } from "./types/log";
import { TenantConfig } from "./auth";
import { isMockMode, devLog, simulateNetworkDelay } from "./devMode";
import { executeDqlQuery } from "./api/grail";

export function useDynatraceQuery<T = unknown>() {
  const [data, setData] = useState<{ records: T[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Abort any in-flight request on unmount to prevent setState on dead component
  // and avoid wasting Grail scan quota.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (query: string, timeframe?: { start: string; end: string }, tenant?: TenantConfig) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      // ── Mock mode ──────────────────────────────────────────────────────────
      if (isMockMode()) {
        devLog("Executing query in mock mode", { query, timeframe });
        await simulateNetworkDelay(100, 400);

        let mockData: unknown[] = [];
        if (query.includes("dt.davis.problems")) {
          mockData = MOCK_PROBLEMS as unknown[];
          devLog("Returning MOCK_PROBLEMS");
        } else if (query.includes("events") && (query.includes("DEPLOYMENT") || query.includes("deployment"))) {
          mockData = MOCK_DEPLOYMENTS as unknown[];
          devLog("Returning MOCK_DEPLOYMENTS");
        } else if (query.includes("spans")) {
          mockData = MOCK_SPANS as unknown[];
          devLog("Returning MOCK_SPANS");
        } else if (query.includes("entity")) {
          mockData = MOCK_ENTITIES as unknown[];
          devLog("Returning MOCK_ENTITIES");
        } else {
          const levelMatch = query.match(/loglevel\s*==\s*"([^"]+)"/i);
          const filterLevel = levelMatch ? levelMatch[1].toUpperCase() : null;
          mockData = filterLevel ? MOCK_LOGS.filter((r: LogRecord) => r.loglevel === filterLevel) : MOCK_LOGS;
          devLog("Returning MOCK_LOGS", { filtered: !!filterLevel, level: filterLevel });
        }

        if (mountedRef.current) {
          setData({ records: mockData as T[] });
          setIsLoading(false);
        }
        return mockData as T[];
      }

      // ── Real API ─────────────────────────────────────────────────────────
      if (!tenant) {
        const message = "No active tenant configured. Please add a tenant via Manage Tenants.";
        if (mountedRef.current) {
          setError(message);
          setIsLoading(false);
        }
        await showToast({ style: Toast.Style.Failure, title: "No Tenant", message });
        return null;
      }

      try {
        const records = await executeDqlQuery<T>(tenant, query, { timeframe, signal });
        if (mountedRef.current) {
          setData({ records });
        }
        return records;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Unmount or new query abort — silently discard
          return null;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        if (mountedRef.current) {
          setError(message);
        }
        await showToast({ style: Toast.Style.Failure, title: "Dynatrace Query Failed", message });
        return null;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, execute, reset };
}
