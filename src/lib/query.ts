// src/lib/query.ts
// Dynatrace Grail query hook — executes DQL queries against the Grail API.

import { useCallback, useEffect, useState, useRef } from "react";
import { showToast, Toast } from "@raycast/api";
import { MOCK_LOGS, MOCK_PROBLEMS, MOCK_DEPLOYMENTS, MOCK_SPANS, MOCK_ENTITIES } from "./api/mock";
import { LogRecord } from "./types/log";
import { grailResponseSchema } from "./types/grail";
import { getAccessToken, invalidateToken, OAuthError, TenantConfig } from "./auth";
import { isMockMode, devLog, simulateNetworkDelay } from "./devMode";
import { ZodError } from "zod";

interface QueryPayload {
  query: string;
  defaultTimeframeStart?: string;
  defaultTimeframeEnd?: string;
  maxResultRecords?: number;
  maxResultBytes?: number;
  requestTimeoutMilliseconds?: number;
  fetchTimeoutSeconds?: number;
  defaultSamplingRatio?: number;
  defaultScanLimitGbytes?: number;
  enablePreview?: boolean;
  enforceQueryConsumptionLimit?: boolean;
  includeContributions?: boolean;
  includeTypes?: boolean;
  locale?: string;
  timezone?: string;
}

const DEFAULT_PAYLOAD: Omit<QueryPayload, "query"> = {
  defaultSamplingRatio: 1,
  defaultScanLimitGbytes: 100,
  enablePreview: true,
  enforceQueryConsumptionLimit: true,
  fetchTimeoutSeconds: 60,
  includeContributions: true,
  includeTypes: true,
  locale: "en_US",
  maxResultBytes: 1000000,
  maxResultRecords: 1000,
  requestTimeoutMilliseconds: 5000,
  timezone: "UTC",
};

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

      // ── Mock mode (Development) ───────────────────────────────────────────────
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
        return mockData;
      }

      // ── Real API ─────────────────────────────────────────────────────────────

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
        return await executeOnce(query, timeframe, tenant, signal, false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
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

      async function executeOnce(
        q: string,
        tf: typeof timeframe,
        t: TenantConfig,
        sig: AbortSignal,
        isRetry: boolean,
      ): Promise<T[] | null> {
        let accessToken: string;
        try {
          accessToken = await getAccessToken(t);
        } catch (authErr) {
          if (authErr instanceof OAuthError) {
            throw new Error(`OAuth error: check client_id / client_secret in Manage Tenants (${authErr.statusCode})`);
          }
          throw authErr;
        }

        const payload: QueryPayload = {
          ...DEFAULT_PAYLOAD,
          query: q,
          ...(tf && { defaultTimeframeStart: tf.start, defaultTimeframeEnd: tf.end }),
        };

        const endpoint = `${t.tenantEndpoint.replace(/\/$/, "")}/platform/storage/query/v1/query:execute`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
          signal: sig,
        });

        const rawText = await response.text();

        // On 401 invalidate cached token and retry once
        if (response.status === 401 && !isRetry) {
          invalidateToken(t.id);
          return executeOnce(q, tf, t, sig, true);
        }

        if (response.status === 401) {
          throw new Error("Authentication failed — token rejected by Dynatrace. Check credentials in Manage Tenants.");
        }
        if (response.status === 403) {
          throw new Error(
            "Access denied — OAuth client is missing required scopes (storage:*:read, entity:read). Check Manage Tenants.",
          );
        }

        if (!response.ok) {
          // Try to surface structured Grail error first
          try {
            const errBody = JSON.parse(rawText);
            if (errBody?.error?.message) {
              throw new Error(`Dynatrace: ${errBody.error.message} (code ${errBody.error.code})`);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message.startsWith("Dynatrace:")) throw parseErr;
          }
          const preview = rawText.startsWith("<")
            ? `Server returned HTML (status ${response.status}). Check your tenant endpoint URL.`
            : `HTTP ${response.status}: ${rawText.slice(0, 300)}`;
          throw new Error(preview);
        }

        if (rawText.trimStart().startsWith("<")) {
          throw new Error(
            "Server returned an HTML page instead of JSON.\n" +
              "This usually means the endpoint URL is wrong or the token has expired.\n" +
              "Please check your tenant configuration in Manage Tenants.",
          );
        }

        let parsedResponse;
        try {
          const parsed = JSON.parse(rawText);
          parsedResponse = grailResponseSchema.parse(parsed);
        } catch (zodErr) {
          if (zodErr instanceof ZodError) {
            throw new Error(
              `Unexpected Grail response format: ${zodErr.issues
                .slice(0, 3)
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join("; ")}`,
            );
          }
          throw zodErr;
        }

        if (parsedResponse.state === "RUNNING") {
          throw new Error("Query still running — narrow the timeframe or reduce data volume");
        }

        const records = (parsedResponse.result?.records ?? []) as T[];
        if (mountedRef.current) {
          setData({ records });
        }
        return records;
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
