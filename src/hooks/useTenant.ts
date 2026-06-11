import { useCachedPromise } from "@raycast/utils";
import { getActiveTenant } from "../lib/tenants";

export function useTenant() {
  const { data: tenant, isLoading, error } = useCachedPromise(getActiveTenant, [], { keepPreviousData: true });

  return {
    tenant: tenant ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}
