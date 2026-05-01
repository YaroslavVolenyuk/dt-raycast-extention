import { useState, useEffect } from "react";
import { getActiveTenant } from "../lib/tenants";
import type { TenantConfig } from "../lib/auth";

export function useTenant() {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getActiveTenant()
      .then((t) => {
        if (isMounted) {
          setTenant(t);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { tenant, isLoading, error };
}
