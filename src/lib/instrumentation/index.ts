// src/lib/instrumentation/index.ts
// Dynatrace OpenTelemetry instrumentation for Raycast extension
// Sends traces and logs to Dynatrace for monitoring user issues

import { nodeSDK, initializeTracing, initializeLogging } from "./tracer";
import { logger, createSpan, recordException } from "./logger";

export { logger, createSpan, recordException };

// Initialize telemetry on module load
let initialized = false;

export async function initializeTelemetry(): Promise<void> {
  if (initialized) return;

  try {
    initializeTracing();
    initializeLogging();
    logger.info("Dynatrace telemetry initialized");
    initialized = true;
  } catch (error) {
    console.error("Failed to initialize telemetry:", error);
    // Continue without telemetry rather than crashing
  }
}

// Export SDK for advanced usage
export { nodeSDK };
