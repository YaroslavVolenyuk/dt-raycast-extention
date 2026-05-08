// src/lib/instrumentation/queryTracing.ts
// Tracing utilities for DQL query execution

import { withTracing, logger } from "./logger";
import * as api from "@opentelemetry/api";

export interface QueryTraceAttributes {
  query?: string;
  queryType?: string;
  tenant?: string;
  userId?: string;
  timeframe?: {
    start?: string;
    end?: string;
  };
}

/**
 * Trace a DQL query execution with detailed metrics
 */
export async function traceQueryExecution<T>(
  queryName: string,
  queryFn: (span: api.Span) => Promise<T>,
  attributes?: QueryTraceAttributes,
): Promise<T> {
  return withTracing(
    `query_execution_${queryName}`,
    "dql-runner",
    async (span) => {
      const startTime = Date.now();

      try {
        // Set query-specific attributes
        if (attributes?.query) {
          span.addEvent("query_started", {
            "dql.query": attributes.query.substring(0, 500), // Limit to 500 chars
            "dql.query_name": queryName,
            "dql.type": attributes.queryType || "unknown",
          });
        }

        // Execute query
        const result = await queryFn(span);

        // Record success metrics
        const duration = Date.now() - startTime;
        span.setAttributes({
          "dql.execution_time_ms": duration,
          "dql.status": "success",
          "dql.result_count": (result as any)?.records?.length || 0,
        });

        logger.debug(`Query executed successfully: ${queryName}`, {
          duration,
          resultCount: (result as any)?.records?.length || 0,
          tenant: attributes?.tenant,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.setAttributes({
          "dql.execution_time_ms": duration,
          "dql.status": "error",
          "error.type": error instanceof Error ? error.name : "Unknown",
        });

        if (error instanceof Error) {
          logger.error(`Query failed: ${queryName}`, error, {
            duration,
            query: attributes?.query?.substring(0, 500),
          });
        }

        throw error;
      }
    },
    {
      command: "dql-runner",
      queryName,
      ...attributes,
    },
  );
}

/**
 * Trace multiple queries in sequence
 */
export async function traceMultipleQueries<T>(
  batchName: string,
  queries: Array<{
    name: string;
    fn: (span: api.Span) => Promise<T>;
    attributes?: QueryTraceAttributes;
  }>,
): Promise<T[]> {
  return withTracing(
    `batch_query_${batchName}`,
    "dql-runner",
    async (span) => {
      span.addEvent("batch_started", {
        "batch.query_count": queries.length,
        "batch.name": batchName,
      });

      const results: T[] = [];
      const startTime = Date.now();

      for (let i = 0; i < queries.length; i++) {
        const { name, fn, attributes: queryAttrs } = queries[i];

        try {
          const result = await traceQueryExecution(name, fn, queryAttrs);
          results.push(result);

          span.addEvent("query_completed", {
            "batch.index": i,
            "batch.query_name": name,
            "batch.status": "success",
          });
        } catch (error) {
          span.addEvent("query_failed", {
            "batch.index": i,
            "batch.query_name": name,
            "batch.status": "error",
            "error.message": error instanceof Error ? error.message : "Unknown error",
          });

          // Continue with remaining queries instead of failing entire batch
          if (error instanceof Error) {
            logger.warning(`Query failed in batch at index ${i}: ${name}`, error);
          }
        }
      }

      const duration = Date.now() - startTime;
      span.setAttributes({
        "batch.total_time_ms": duration,
        "batch.succeeded": results.length,
        "batch.failed": queries.length - results.length,
      });

      logger.info(`Batch query completed: ${batchName}`, {
        totalQueries: queries.length,
        succeeded: results.length,
        failed: queries.length - results.length,
        duration,
      });

      return results;
    },
    {
      command: "dql-runner",
      batchName,
      queryCount: queries.length,
    },
  );
}

/**
 * Trace API call to Dynatrace
 */
export async function traceApiCall<T>(
  endpoint: string,
  apiFn: (span: api.Span) => Promise<T>,
  method: string = "GET",
  attributes?: Record<string, unknown>,
): Promise<T> {
  return withTracing(
    `api_call_${method}_${endpoint}`,
    "dynatrace-api",
    async (span) => {
      const startTime = Date.now();

      try {
        span.addEvent("api_call_started", {
          "http.method": method,
          "http.url": endpoint,
          ...attributes,
        });

        const result = await apiFn(span);
        const duration = Date.now() - startTime;

        span.setAttributes({
          "http.status_code": 200,
          "http.duration_ms": duration,
          "http.method": method,
          "http.url": endpoint,
        });

        logger.debug(`API call succeeded: ${method} ${endpoint}`, {
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "API call failed",
        });

        span.setAttributes({
          "http.duration_ms": duration,
          "http.method": method,
          "http.url": endpoint,
          "error": true,
        });

        if (error instanceof Error) {
          logger.error(`API call failed: ${method} ${endpoint}`, error, {
            duration,
          });
        }

        throw error;
      }
    },
    {
      command: "dynatrace-api",
      endpoint,
      method,
    },
  );
}
