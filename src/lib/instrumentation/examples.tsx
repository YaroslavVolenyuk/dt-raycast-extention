// src/lib/instrumentation/examples.tsx
// Example integration patterns for Raycast components

import { useCallback } from "react";
import { logger, recordException } from "./logger";
import { useTracing, useFetchTracing } from "./useTracing";
import { traceQueryExecution } from "./queryTracing";
import * as api from "@opentelemetry/api";

/**
 * EXAMPLE 1: Simple logging in a component
 */
export function ExampleSimpleLogging() {
  const handleClick = useCallback(() => {
    logger.info("Button clicked", { action: "fetch_problems", source: "problems-list" });
  }, []);

  return <button onClick={handleClick}>Fetch Problems</button>;
}

/**
 * EXAMPLE 2: Using useTracing hook for async operations
 */
export function ExampleUsingTracingHook() {
  const { traceAsync, log } = useTracing({
    commandName: "dt-problems",
    userId: "user@company.com",
    attributes: {
      version: "1.0.0",
    },
  });

  const fetchProblems = useCallback(async () => {
    await traceAsync("fetch_problems_list", async (span) => {
      log("info", "Fetching problems");

      try {
        const response = await fetch("https://api.dynatrace.com/api/v2/problems");
        const data = await response.json();

        span.setAttributes({
          "http.status_code": response.status,
          "http.response_size": JSON.stringify(data).length,
          "problems.count": data.problems?.length || 0,
        });

        log("debug", "Problems fetched successfully", {
          count: data.problems?.length,
        });

        return data;
      } catch (error) {
        if (error instanceof Error) {
          log("error", "Failed to fetch problems", {
            error: error.message,
          });
          throw error;
        }
      }
    });
  }, [traceAsync, log]);

  return <button onClick={fetchProblems}>Fetch</button>;
}

/**
 * EXAMPLE 3: Tracing DQL query execution
 */
export async function ExampleDQLQueryTracing(dql: string, tenantId: string) {
  return traceQueryExecution(
    "execute_dql_query",
    async (span) => {
      logger.info("Executing DQL query", { query: dql.substring(0, 100), tenant: tenantId });

      // Your API call here
      const response = await fetch("https://api.dynatrace.com/api/v2/query/execute", {
        method: "POST",
        body: JSON.stringify({ query: dql }),
        headers: { "Authorization": `Bearer token` },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();

      span.setAttributes({
        "dql.result_count": result.records?.length || 0,
        "dql.columns": result.columns?.length || 0,
      });

      return result;
    },
    {
      query: dql,
      queryType: "davis_problems",
      tenant: tenantId,
    },
  );
}

/**
 * EXAMPLE 4: Error handling and exception recording
 */
export async function ExampleErrorHandling() {
  try {
    logger.info("Starting operation");

    // Some operation that might fail
    const result = await fetch("https://api.dynatrace.com/api/v2/data").then((r) => r.json());

    logger.info("Operation completed", { resultSize: JSON.stringify(result).length });

    return result;
  } catch (error) {
    // Automatically records exception in current span
    if (error instanceof Error) {
      recordException(error);
      logger.error("Operation failed", error, { operation: "fetch_data" });
    }
    throw error;
  }
}

/**
 * EXAMPLE 5: Wrapping existing React component with tracing
 */
export function ExampleWrappedComponent({ data }: { data: any }) {
  const { traceAsync } = useTracing({
    commandName: "dt-problems",
  });

  const processData = useCallback(async () => {
    return await traceAsync("process_data", async (span) => {
      const startTime = Date.now();

      // Processing logic
      const processed = data.map((item: any) => ({
        ...item,
        processed: true,
      }));

      const duration = Date.now() - startTime;

      span.setAttributes({
        "data.input_count": data.length,
        "data.output_count": processed.length,
        "processing_time_ms": duration,
      });

      logger.info("Data processed", {
        inputCount: data.length,
        outputCount: processed.length,
        duration,
      });

      return processed;
    });
  }, [data, traceAsync]);

  return <button onClick={processData}>Process</button>;
}

/**
 * EXAMPLE 6: Using useFetchTracing for data fetching
 */
export function ExampleFetchTracing() {
  const { traceDataFetch } = useFetchTracing("dt-problems");

  const loadProblems = useCallback(async () => {
    const problems = await traceDataFetch(
      "load_problems",
      async () => {
        const response = await fetch("https://api.dynatrace.com/api/v2/problems");
        return response.json();
      },
      {
        source: "problems-list",
      },
    );

    return problems;
  }, [traceDataFetch]);

  return <button onClick={loadProblems}>Load</button>;
}

/**
 * EXAMPLE 7: Custom span attributes
 */
export async function ExampleCustomAttributes() {
  const span = api.trace.getActiveSpan();

  if (span) {
    span.setAttributes({
      "custom.user_id": "user123",
      "custom.tenant": "tenant456",
      "custom.action": "fetch_problems",
      "custom.tags": JSON.stringify(["important", "performance"]),
    });
  }

  logger.info("Operation with custom attributes", {
    userId: "user123",
    tenant: "tenant456",
    action: "fetch_problems",
  });
}

/**
 * EXAMPLE 8: Batch operations with tracing
 */
export async function ExampleBatchOperations(queries: Array<{ name: string; dql: string }>) {
  const spans: api.Span[] = [];
  const results: any[] = [];

  for (const { name, dql } of queries) {
    try {
      const result = await traceQueryExecution(
        name,
        async (span) => {
          spans.push(span);
          logger.debug(`Executing query: ${name}`);
          // Your fetch logic
          return { name, success: true };
        },
        { query: dql },
      );
      results.push(result);
    } catch (error) {
      logger.warning(`Query failed: ${name}`, error as Error);
    }
  }

  logger.info("Batch operations completed", {
    total: queries.length,
    successful: results.length,
    failed: queries.length - results.length,
  });

  return results;
}

/**
 * EXAMPLE 9: Performance monitoring
 */
export async function ExamplePerformanceMonitoring() {
  const startTime = Date.now();
  const span = api.trace.getActiveSpan();

  try {
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const duration = Date.now() - startTime;

    if (span) {
      span.setAttributes({
        "performance.duration_ms": duration,
        "performance.slow": duration > 500,
      });
    }

    logger.info("Operation completed", { duration, slow: duration > 500 });
  } catch (error) {
    if (error instanceof Error) {
      recordException(error);
    }
  }
}

/**
 * EXAMPLE 10: Context-aware logging
 */
export function ExampleContextAware(userId: string, commandName: string) {
  const { log } = useTracing({
    commandName,
    userId,
  });

  log("info", "User action", { action: "opened_command" });
  log("debug", "Loading data", { dataType: "problems" });
  log("warning", "API response slow", { duration: 2000 });

  return null;
}
