// src/lib/api/useRest.ts
// React hook for declarative REST API calls with loading/error states and auto-refresh

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast, Toast } from "@raycast/api";
import { dynatraceRest, RestClientOptions, RestError, ValidationError, DavisCopilotUnavailableError } from "./rest";
import { TenantConfig } from "../auth";
import { devLog } from "../devMode";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseRestOptions<T> extends RestClientOptions<T> {
  interval?: number; // Auto-refresh interval in milliseconds
  enabled?: boolean; // Enable/disable the hook (defaults to true)
  showErrorToast?: boolean; // Show error toast on failure (defaults to true)
  onError?: (error: RestError | ValidationError) => void;
}

export interface UseRestState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  revalidate: () => Promise<void>;
}

// ── Helper: Error to Human-Readable String ────────────────────────────────────

function errorToString(error: unknown): string {
  if (error instanceof DavisCopilotUnavailableError) {
    return "Davis CoPilot requires a Platform Subscription";
  }

  if (error instanceof RestError) {
    return error.message;
  }

  if (error instanceof ValidationError) {
    const firstError = error.zodError?.errors?.[0];
    const msg = typeof firstError === 'object' ? firstError?.message : String(firstError);
    return `Invalid response format: ${msg || "validation failed"}`;
  }

  // Handle AbortError when request is cancelled
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Request was cancelled";
    }
    return error.message;
  }

  return String(error);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * React hook for declarative REST API calls with loading/error states.
 *
 * @param tenant - Tenant configuration
 * @param path - API endpoint path
 * @param options - Fetch options + hook-specific options
 * @returns UseRestState<T>
 *
 * @example
 * const { data, isLoading, error, revalidate } = useDynatraceRest<SLO[]>(
 *   tenant,
 *   "/api/v2/slo",
 *   {
 *     schema: sloListSchema,
 *     interval: 60000, // Auto-refresh every 60s
 *     enabled: true,
 *   }
 * );
 *
 * if (isLoading) return <List isLoading />;
 * if (error) return <Detail markdown={`# Error\n\n${error}`} />;
 *
 * return (
 *   <List>
 *     {data?.map(slo => <List.Item key={slo.id} title={slo.name} />)}
 *   </List>
 * );
 */
export function useDynatraceRest<T = unknown>(
  tenant: TenantConfig,
  path: string,
  options: UseRestOptions<T> = {},
): UseRestState<T> {
  const { interval, enabled = true, showErrorToast = true, onError, ...restOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      devLog("useDynatraceRest: hook is disabled");
      setIsLoading(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      devLog(`useDynatraceRest: fetching ${path}`, { interval, enabled });

      const response = await dynatraceRest<T>(tenant, path, {
        ...restOptions,
        signal: abortRef.current.signal,
      });

      setData(response.data);
      setError(null);
    } catch (err) {
      // Ignore AbortError and wrapped RestError from cancelled requests
      if (err instanceof Error && err.name === "AbortError") {
        devLog(`useDynatraceRest: request cancelled for ${path}`);
        return;
      }

      if (err instanceof RestError && err.statusCode === 0 && err.message.includes("abort")) {
        devLog(`useDynatraceRest: request aborted for ${path}`);
        return;
      }

      const errorMessage = errorToString(err);
      setError(errorMessage);

      if (showErrorToast) {
        showToast({
          style: Toast.Style.Failure,
          title: "API Error",
          message: errorMessage,
        });
      }

      if (onError && (err instanceof RestError || err instanceof ValidationError)) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenant, path, enabled, showErrorToast, onError]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling if interval is specified
    if (interval && interval > 0) {
      intervalRef.current = setInterval(fetchData, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    // Cleanup on unmount
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, interval, fetchData]);

  const revalidate = useCallback(async () => {
    devLog(`useDynatraceRest: manual revalidation of ${path}`);
    await fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    revalidate,
  };
}
