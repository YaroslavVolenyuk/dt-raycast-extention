// src/useDynatraceQuery.ts

import { useCallback, useState } from "react";
import { getPreferenceValues, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import { MOCK_LOGS } from "../fakeDB/dql";
import { LogRecord } from "./types/log";
import { grailResponseSchema } from "./types/grail";
import { ZodError } from "zod";

interface ExtensionPrefs {
  dynatraceEndpoint: string;
  dynatraceToken: string;
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

  const execute = useCallback(async (query: string, timeframe?: { start: string; end: string }) => {
    setIsLoading(true);
    setError(null);

    let prefs: ExtensionPrefs;
    try {
      prefs = getPreferenceValues<ExtensionPrefs>();
      if (!prefs.dynatraceEndpoint || !prefs.dynatraceToken) {
        throw new Error("Missing credentials");
      }
    } catch {
      const message = "Dynatrace endpoint or token not configured. Please open extension preferences.";
      setError(message);
      await showToast({
        style: Toast.Style.Failure,
        title: "Configuration Required",
        message,
        primaryAction: {
          title: "Open Preferences",
          onAction: () => openExtensionPreferences(),
        },
      });
      setIsLoading(false);
      return null;
    }

    // ── Mock mode ──────────────────────────────────────────────────────────
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
    // ── Real API ───────────────────────────────────────────────────────────

    const payload: QueryPayload = {
      ...DEFAULT_PAYLOAD,
      query,
      ...(timeframe && {
        defaultTimeframeStart: timeframe.start,
        defaultTimeframeEnd: timeframe.end,
      }),
    };

    try {
      const endpoint = `${prefs.dynatraceEndpoint.replace(/\/$/, "")}/platform/storage/query/v1/query:execute`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${prefs.dynatraceToken}`,
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();

      if (!response.ok) {
        // Non-2xx: try to extract a useful message
        const preview = rawText.startsWith("<")
          ? `Server returned HTML (status ${response.status}). Check your endpoint URL.`
          : `HTTP ${response.status}: ${rawText.slice(0, 300)}`;
        throw new Error(preview);
      }

      // Guard against HTML responses with 200 status (e.g. auth redirect pages)
      if (rawText.trimStart().startsWith("<")) {
        throw new Error(
          "Server returned an HTML page instead of JSON.\n" +
            "This usually means the endpoint URL is wrong or the token has expired.\n" +
            "Please check your preferences (endpoint & token).",
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
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      await showToast({ style: Toast.Style.Failure, title: "Dynatrace Query Failed", message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, execute, reset };
}
