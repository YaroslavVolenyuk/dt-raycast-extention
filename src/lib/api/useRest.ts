// src/lib/api/useRest.ts
// React hook for declarative REST API calls with loading/error states and caching

import { useCachedPromise } from "@raycast/utils";
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
  // interval kept in type for API compat but not used — useCachedPromise handles caching
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { interval, enabled = true, showErrorToast = true, onError, ...restOptions } = options;

  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (tenantArg: TenantConfig, apiPath: string) => {
      devLog(`useDynatraceRest: fetching ${apiPath}`);
      const response = await dynatraceRest<T>(tenantArg, apiPath, restOptions);
      return response.data;
    },
    [tenant as TenantConfig, path],
    {
      execute: enabled && !!tenant,
      onError: (err) => {
        const errorMessage = errorToString(err);
        if (showErrorToast) {
          showToast({ style: Toast.Style.Failure, title: "API Error", message: errorMessage });
        }
        if (onError && (err instanceof RestError || err instanceof ValidationError)) {
          onError(err);
        }
      },
    },
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ? errorToString(error) : null,
    revalidate: async () => {
      await revalidate();
    },
  };
}
