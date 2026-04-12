// https://dbq7162d.dev.apps.dynatracelabs.com/platform/storage/query/v1/query:execute


// hooks/useDynatraceQuery.ts
import { useState, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import * as process from "node:process";

const DYNATRACE_ENDPOINT =
  "https://dbq7162d.dev.apps.dynatracelabs.com/platform/storage/query/v1/query:execute";
interface QueryPayload {
  query: string;
  defaultTimeframeStart?: string;
  defaultTimeframeEnd?: string;
  maxResultRecords?: number;
  requestTimeoutMilliseconds?: number;
}

interface QueryResult<T = unknown> {
  records?: T[];
  metadata?: {
    grailQueryId?: string;
    notifications?: string[];
  };
  progress?: number;
  state?: "SUCCEEDED" | "RUNNING" | "FAILED" | "CANCELLED";
}

interface UseDynatraceQueryReturn<T> {
  data: QueryResult<T> | null;
  isLoading: boolean;
  error: string | null;
  execute: (payload: QueryPayload) => Promise<QueryResult<T> | null>;
  reset: () => void;
}

export function useDynatraceQuery<T = unknown>(): UseDynatraceQueryReturn<T> {
  const [data, setData] = useState<QueryResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (payload: QueryPayload): Promise<QueryResult<T> | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(DYNATRACE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env["DT_TOKEN "]}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result: QueryResult<T> = await response.json();
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      await showToast({
        style: Toast.Style.Failure,
        title: "Dynatrace Query Failed",
        message,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, execute, reset };
}