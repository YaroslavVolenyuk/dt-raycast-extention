// src/lib/instrumentation/useTracing.ts
// React hook for easy tracing in Raycast components

import { useCallback, useEffect, useRef } from "react";
import { withTracing, withTracingSync, logger } from "./logger";
import * as api from "@opentelemetry/api";

interface UseTracingOptions {
  commandName: string;
  userId?: string;
  attributes?: Record<string, unknown>;
}

export function useTracing(options: UseTracingOptions) {
  const tracingRef = useRef(options);

  // Update context when options change
  useEffect(() => {
    tracingRef.current = options;
  }, [options]);

  // Wrap async operation with tracing
  const traceAsync = useCallback(
    async <T,>(operationName: string, fn: (span: api.Span) => Promise<T>): Promise<T> => {
      return withTracing(operationName, tracingRef.current.commandName, fn, {
        userId: tracingRef.current.userId,
        ...tracingRef.current.attributes,
      });
    },
    [],
  );

  // Wrap sync operation with tracing
  const traceSync = useCallback(
    <T,>(operationName: string, fn: (span: api.Span) => T): T => {
      return withTracingSync(operationName, tracingRef.current.commandName, fn, {
        userId: tracingRef.current.userId,
        ...tracingRef.current.attributes,
      });
    },
    [],
  );

  // Log with context
  const log = useCallback(
    (level: "debug" | "info" | "warning" | "error", message: string, attributes?: Record<string, unknown>) => {
      const logMethod = logger[level].bind(logger);
      logMethod(message, {
        command: tracingRef.current.commandName,
        userId: tracingRef.current.userId,
        ...attributes,
      });
    },
    [],
  );

  return {
    traceAsync,
    traceSync,
    log,
  };
}

// Hook for tracking page/view loads
export function usePageTracing(commandName: string, attributes?: Record<string, unknown>) {
  useEffect(() => {
    logger.info(`View loaded: ${commandName}`, attributes);

    return () => {
      logger.info(`View unloaded: ${commandName}`);
    };
  }, [commandName, attributes]);
}

// Hook for tracking data fetches
export function useFetchTracing(commandName: string) {
  const traceDataFetch = useCallback(
    async <T,>(
      operationName: string,
      fetchFn: () => Promise<T>,
      attributes?: Record<string, unknown>,
    ): Promise<T> => {
      return withTracing(`${commandName}/${operationName}`, commandName, async (span) => {
        try {
          const startTime = Date.now();
          const result = await fetchFn();
          const duration = Date.now() - startTime;

          span.setAttributes({
            "http.duration_ms": duration,
            "http.status": "success",
            ...attributes,
          });

          logger.debug(`Data fetch succeeded: ${operationName}`, {
            duration,
            ...attributes,
          });

          return result;
        } catch (error) {
          if (error instanceof Error) {
            span.setAttributes({
              "error": true,
              "error.type": error.name,
            });
            logger.error(`Data fetch failed: ${operationName}`, error, attributes);
          }
          throw error;
        }
      });
    },
    [commandName],
  );

  return { traceDataFetch };
}
