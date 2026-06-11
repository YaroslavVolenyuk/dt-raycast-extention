// src/lib/api/useRest.ts
// React hook for declarative REST API calls with loading/error states and auto-refresh

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast, Toast } from "@raycast/api";
import { dynatraceRest, RestClientOptions, RestError, ValidationError, DavisCopilotUnavailableError } from "./rest";
import { TenantConfig } from "../auth";
import { devLog } from "../devMode";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseRestOptions<T> extends RestClientOptions<T> {
  interval?: number;
  enabled?: boolean;
  showErrorToast?: boolean;
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
    const firstError = error.zodError?.issues?.[0];
    const msg = typeof firstError === "object" ? firstError?.message : String(firstError);
    return `Invalid response format: ${msg || "validation failed"}`;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Request was cancelled";
    return error.message;
  }
  return String(error);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDynatraceRest<T = unknown>(
  tenant: TenantConfig | undefined,
  path: string,
  options: UseRestOptions<T> = {},
): UseRestState<T> {
  const { interval, enabled = true, showErrorToast = true, onError, ...restOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasErrorRef = useRef(false); // tracks error state to avoid toast spam on polling

  // Stable ref for restOptions — avoids stale closure without putting the object in deps
  const restOptionsRef = useRef(restOptions);
  restOptionsRef.current = restOptions;

  // Serialize the parts that affect the request URL/body for dep comparison
  const optionsKey = JSON.stringify({ method: restOptions.method, queryParams: restOptions.queryParams });

  const fetchData = useCallback(async () => {
    if (!enabled || !tenant) {
      devLog("useDynatraceRest: hook is disabled or no tenant");
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      devLog(`useDynatraceRest: fetching ${path}`, { interval, enabled });

      const response = await dynatraceRest<T>(tenant, path, {
        ...restOptionsRef.current,
        signal: abortRef.current.signal,
      });

      setData(response.data);
      setError(null);
      hasErrorRef.current = false;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        devLog(`useDynatraceRest: request cancelled for ${path}`);
        return;
      }
      if (err instanceof RestError && err.statusCode === 0 && err.message.includes("abort")) {
        devLog(`useDynatraceRest: request aborted for ${path}`);
        return;
      }

      const errorMessage = errorToString(err);
      // Only toast on transition from no-error to error (suppress repeated polling toasts)
      const shouldShowToast = showErrorToast && !hasErrorRef.current;
      hasErrorRef.current = true;
      setError(errorMessage);

      if (shouldShowToast) {
        showToast({ style: Toast.Style.Failure, title: "API Error", message: errorMessage });
      }

      if (onError && (err instanceof RestError || err instanceof ValidationError)) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id, path, enabled, showErrorToast, onError, optionsKey]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();
    const id = interval && interval > 0 ? setInterval(fetchData, interval) : null;

    return () => {
      if (id) clearInterval(id);
      abortRef.current?.abort();
    };
  }, [enabled, interval, fetchData]);

  const revalidate = useCallback(async () => {
    devLog(`useDynatraceRest: manual revalidation of ${path}`);
    hasErrorRef.current = false; // allow toast on manual refresh
    await fetchData();
  }, [fetchData, path]);

  return { data, isLoading, error, revalidate };
}
