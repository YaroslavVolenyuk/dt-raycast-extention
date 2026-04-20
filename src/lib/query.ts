// src/lib/query.ts
// Dynatrace Grail query hook — executes DQL queries against the Grail API.

import { useCallback, useState, useRef } from "react";
import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { MOCK_LOGS } from "./api/mock";
import { LogRecord } from "./types/log";
import { grailResponseSchema } from "./types/grail";
import { getAccessToken, OAuthError, TenantConfig } from "./auth";
import { ZodError } from "zod";

interface ExtensionPrefs {
  useMockData: boolean;
}

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

// Default payload — matches working Postman example
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

  const execute = useCallback(
    async (query: string, timeframe?: { start: string; end: string }, tenant?: TenantConfig) => {
      // Abort previous request to prevent race conditions
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setIsLoading(true);
      setError(null);

      const prefs = getPreferenceValues<ExtensionPrefs>();

      // ── Mock mode ────────────────────────────────────────────────────────────
      if (prefs.useMockData) {
        await showToast({ style: Toast.Style.Success, title: "Mock Mode Active", message: "Using local fake data" });
        // Extract log level from DQL query string (e.g. 'filter loglevel == "ERROR"')
        const levelMatch = query.match(/loglevel\s*==\s*"([^"]+)"/i);
        const filterLevel = levelMatch ? levelMatch[1].toUpperCase() : null;
        const records = filterLevel ? MOCK_LOGS.filter((r: LogRecord) => r.loglevel === filterLevel) : MOCK_LOGS;
        await new Promise((res) => setTimeout(res, 300)); // simulate latency
        setData({ records: records as T[] });
        setIsLoading(false);
        return records;
      }

      // ── Real API ─────────────────────────────────────────────────────────────

      if (!tenant) {
        const message = "No active tenant configured. Please add a tenant via Manage Tenants.";
        setError(message);
        await showToast({ style: Toast.Style.Failure, title: "No Tenant", message });
        setIsLoading(false);
        return null;
      }

      try {
        // Obtain access token (cached, proactively refreshed)
        let accessToken: string;
        try {
          accessToken = await getAccessToken(tenant);
        } catch (authErr) {
          if (authErr instanceof OAuthError) {
            throw new Error(`OAuth error: check client_id / client_secret in Manage Tenants (${authErr.statusCode})`);
          }
          throw authErr;
        }

        const payload: QueryPayload = {
          ...DEFAULT_PAYLOAD,
          query,
          ...(timeframe && {
            defaultTimeframeStart: timeframe.start,
            defaultTimeframeEnd: timeframe.end,
          }),
        };

        const endpoint = `${tenant.tenantEndpoint.replace(/\/$/, "")}/platform/storage/query/v1/query:execute`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
          signal,
        });

        const rawText = await response.text();

        if (!response.ok) {
          const preview = rawText.startsWith("<")
            ? `Server returned HTML (status ${response.status}). Check your tenant endpoint URL.`
            : `HTTP ${response.status}: ${rawText.slice(0, 300)}`;
          throw new Error(preview);
        }

        // Guard against HTML responses with 200 status (e.g. auth redirect pages)
        if (rawText.trimStart().startsWith("<")) {
          throw new Error(
            "Server returned an HTML page instead of JSON.\n" +
              "This usually means the endpoint URL is wrong or the token has expired.\n" +
              "Please check your tenant configuration in Manage Tenants.",
          );
        }

        // Validate response shape with Zod — throws a readable error for unexpected JSON
        let parsedResponse;
        try {
          parsedResponse = grailResponseSchema.parse(JSON.parse(rawText));
        } catch (zodErr) {
          if (zodErr instanceof ZodError) {
            throw new Error(`Unexpected Grail response format: ${zodErr.issues.map((e) => e.message).join("; ")}`);
          }
          throw zodErr;
        }

        // Postman confirmed that records are nested under result.records
        const records = (parsedResponse.result?.records ?? []) as T[];
        setData({ records });
        return records;
      } catch (err) {
        // Silently ignore AbortError — request was cancelled intentionally
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        await showToast({ style: Toast.Style.Failure, title: "Dynatrace Query Failed", message });
        return null;
      } finally {
        setIsLoading(false);
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
