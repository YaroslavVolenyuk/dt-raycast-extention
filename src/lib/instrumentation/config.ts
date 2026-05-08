// src/lib/instrumentation/config.ts
// Configuration and setup utilities for instrumentation

/**
 * Instrumentation configuration
 */
export interface InstrumentationConfig {
  enabled: boolean;
  dynatrace: {
    environmentId: string;
    apiToken: string;
    clusterId?: string;
    otelEndpoint: string;
  };
  logging: {
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL";
    console: boolean;
    telemetry: boolean;
  };
  tracing: {
    samplingRatio: number;
    batchSize: number;
    flushInterval: number;
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): InstrumentationConfig {
  const enabled =
    process.env.DYNATRACE_API_TOKEN && process.env.DYNATRACE_ENVIRONMENT_ID ? true : false;

  return {
    enabled,
    dynatrace: {
      environmentId: process.env.DYNATRACE_ENVIRONMENT_ID || "local",
      apiToken: process.env.DYNATRACE_API_TOKEN || "",
      clusterId: process.env.DYNATRACE_CLUSTER_ID,
      otelEndpoint:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || "INFO",
      console: process.env.NODE_ENV === "development",
      telemetry: enabled,
    },
    tracing: {
      samplingRatio: parseFloat(process.env.OTEL_SAMPLING_RATIO || "1.0"),
      batchSize: parseInt(process.env.OTEL_BATCH_SIZE || "100", 10),
      flushInterval: parseInt(process.env.OTEL_FLUSH_INTERVAL || "5000", 10),
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: InstrumentationConfig): string[] {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.dynatrace.environmentId) {
      errors.push("DYNATRACE_ENVIRONMENT_ID is required");
    }
    if (!config.dynatrace.apiToken) {
      errors.push("DYNATRACE_API_TOKEN is required");
    }
    if (!config.dynatrace.otelEndpoint) {
      errors.push("OTEL_EXPORTER_OTLP_ENDPOINT is required");
    }
  }

  if (config.tracing.samplingRatio < 0 || config.tracing.samplingRatio > 1) {
    errors.push("OTEL_SAMPLING_RATIO must be between 0 and 1");
  }

  return errors;
}

/**
 * Get config summary for logging
 */
export function getConfigSummary(config: InstrumentationConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    environment: config.dynatrace.environmentId,
    otelEndpoint: config.dynatrace.otelEndpoint.split("?")[0], // Remove query params for logging
    logLevel: config.logging.level,
    samplingRatio: config.tracing.samplingRatio,
  };
}

/**
 * Check if instrumentation should be used
 */
export function shouldInstrument(): boolean {
  // Disable in production if not explicitly enabled
  if (process.env.NODE_ENV === "production") {
    return process.env.ENABLE_INSTRUMENTATION === "true";
  }

  // Enable in development by default
  return true;
}

/**
 * Get logger function based on environment
 */
export function getLogFn(): typeof console.log {
  if (process.env.NODE_ENV === "test") {
    return () => {}; // Silent in tests
  }
  return console.log;
}

// Default configuration
const DEFAULT_CONFIG = loadConfig();

export default DEFAULT_CONFIG;
