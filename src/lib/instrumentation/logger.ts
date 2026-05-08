// src/lib/instrumentation/logger.ts
// High-level logger and tracing utilities for Raycast extension

import * as api from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { tracer, getLogger as getTelemetryLogger } from "./tracer";
import { Context } from "@opentelemetry/api";

const telemetryLogger = getTelemetryLogger();

// Log levels
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

// Log entry interface
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  attributes?: Record<string, unknown>;
  error?: Error;
  userId?: string;
  commandName?: string;
  context?: Record<string, unknown>;
}

// Logger class
class Logger {
  private commandName?: string;
  private userId?: string;

  constructor(commandName?: string, userId?: string) {
    this.commandName = commandName;
    this.userId = userId;
  }

  private log(level: LogLevel, message: string, attributes?: Record<string, unknown>, error?: Error): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      attributes,
      error,
      userId: this.userId,
      commandName: this.commandName,
    };

    // Log to console in development
    const logFn = level === LogLevel.ERROR || level === LogLevel.FATAL ? console.error : console.log;
    logFn(`[${level}] ${message}`, attributes || {});

    // Send to Dynatrace
    this.sendToTelemetry(logEntry);
  }

  private sendToTelemetry(entry: LogEntry): void {
    try {
      const severityMap: Record<LogLevel, SeverityNumber> = {
        [LogLevel.DEBUG]: SeverityNumber.DEBUG,
        [LogLevel.INFO]: SeverityNumber.INFO,
        [LogLevel.WARNING]: SeverityNumber.WARN,
        [LogLevel.ERROR]: SeverityNumber.ERROR,
        [LogLevel.FATAL]: SeverityNumber.FATAL,
      };

      const attributes: Record<string, unknown> = {
        "raycast.command": this.commandName,
        "raycast.user_id": this.userId,
        ...entry.attributes,
      };

      if (entry.error) {
        attributes["exception.type"] = entry.error.name;
        attributes["exception.message"] = entry.error.message;
        attributes["exception.stacktrace"] = entry.error.stack;
      }

      telemetryLogger.emit({
        severityNumber: severityMap[entry.level],
        severityText: entry.level,
        body: entry.message,
        attributes,
        timestamp: entry.timestamp,
      });
    } catch (error) {
      console.error("Failed to send log to telemetry:", error);
    }
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, attributes);
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, attributes);
  }

  warning(message: string, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.WARNING, message, attributes);
  }

  error(message: string, error?: Error, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, attributes, error);
  }

  fatal(message: string, error?: Error, attributes?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, attributes, error);
  }

  withContext(context: Record<string, unknown>): Logger {
    const contextLogger = new Logger(this.commandName, this.userId);
    // Store context for future use if needed
    return contextLogger;
  }
}

// Global logger instance
export const logger = new Logger();

// Create span for tracing operations
export function createSpan(
  name: string,
  operationName: string,
  attributes?: Record<string, unknown>,
  context?: Context,
): api.Span {
  const span = tracer.startSpan(operationName, { attributes }, context);

  // Set standard attributes
  span.setAttributes({
    "raycast.operation": operationName,
    "raycast.command": name,
    "code.function": operationName,
    ...attributes,
  });

  return span;
}

// Record exception in current span
export function recordException(error: Error, span?: api.Span): void {
  const targetSpan = span || api.trace.getActiveSpan();

  if (targetSpan) {
    targetSpan.recordException(error);
    targetSpan.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  logger.error("Exception recorded", error, {
    errorName: error.name,
    errorMessage: error.message,
  });
}

// Utility: Wrap async function with tracing
export async function withTracing<T>(
  operationName: string,
  commandName: string,
  fn: (span: api.Span) => Promise<T>,
  attributes?: Record<string, unknown>,
): Promise<T> {
  const span = createSpan(commandName, operationName, attributes);

  try {
    return await api.context.with(api.trace.setSpan(api.context.active(), span), async () => {
      const result = await fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    });
  } catch (error) {
    if (error instanceof Error) {
      recordException(error, span);
    }
    throw error;
  } finally {
    span.end();
  }
}

// Utility: Wrap sync function with tracing
export function withTracingSync<T>(
  operationName: string,
  commandName: string,
  fn: (span: api.Span) => T,
  attributes?: Record<string, unknown>,
): T {
  const span = createSpan(commandName, operationName, attributes);

  try {
    const result = api.context.with(api.trace.setSpan(api.context.active(), span), () => {
      return fn(span);
    });
    span.setStatus({ code: api.SpanStatusCode.OK });
    return result;
  } catch (error) {
    if (error instanceof Error) {
      recordException(error, span);
    }
    throw error;
  } finally {
    span.end();
  }
}
