// src/lib/instrumentation/tracer.ts
// OpenTelemetry configuration and tracer setup

import * as api from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  AlwaysOnSampler,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { LoggerProvider, SimpleLogRecordProcessor, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { logs } from "@opentelemetry/api-logs";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { CompositePropagator } from "@opentelemetry/core";

// Get configuration from environment or defaults
const DYNATRACE_ENVIRONMENT_ID = process.env.DYNATRACE_ENVIRONMENT_ID || "dynatrace";
const DYNATRACE_API_TOKEN = process.env.DYNATRACE_API_TOKEN || "";
const DYNATRACE_CLUSTER_ID = process.env.DYNATRACE_CLUSTER_ID || "";
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

// Create resource
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "raycast-dynatrace-connector",
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
    "dynatrace.environment": DYNATRACE_ENVIRONMENT_ID,
    "application.name": "Raycast Dynatrace Extension",
    "application.version": "1.0.0",
  }),
);

// Trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers: {
    "Authorization": `Bearer ${DYNATRACE_API_TOKEN}`,
  },
});

// Log exporter
const logExporter = new OTLPLogExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
  headers: {
    "Authorization": `Bearer ${DYNATRACE_API_TOKEN}`,
  },
});

// Create tracer provider
export const tracerProvider = new BasicTracerProvider({
  resource,
  sampler: new AlwaysOnSampler(),
});

// Add span processors
tracerProvider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
// For production, use BatchSpanProcessor for better performance
// tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

// Register tracer provider globally
api.trace.setGlobalTracerProvider(tracerProvider);

// Create logger provider
export const loggerProvider = new LoggerProvider({
  resource,
});

loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
// For production, use BatchLogRecordProcessor
// loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));

// Register logger provider globally
logs.setGlobalLoggerProvider(loggerProvider);

// Get tracer
export const tracer = api.trace.getTracer("raycast-dynatrace-connector", "1.0.0");

// Get logger
export const getLogger = () => {
  return logs.getLogger("raycast-dynatrace-connector", { version: "1.0.0" });
};

// Initialize tracing
export function initializeTracing(): void {
  console.log("Tracer initialized for Dynatrace");
}

// Initialize logging
export function initializeLogging(): void {
  console.log("Logger initialized for Dynatrace");
}

// Node SDK exports (for advanced usage)
export const nodeSDK = {
  tracerProvider,
  loggerProvider,
  tracer,
  getLogger,
};
