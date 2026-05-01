import { z } from "zod";

/**
 * Dynatrace Metric types for metrics explorer
 */

export const DataPointSchema = z.object({
  timestamp: z.number().describe("Unix timestamp in milliseconds"),
  value: z.number().describe("Metric value"),
});

export type DataPoint = z.infer<typeof DataPointSchema>;

export const MetricSchema = z.object({
  metricId: z.string().describe("Unique metric identifier"),
  displayName: z.string().describe("Human-readable metric name"),
  description: z.string().optional().describe("Metric description"),
  unit: z.string().describe("Unit of measurement (ms, %, bytes, etc)"),
  aggregationType: z.enum(["AVG", "SUM", "MIN", "MAX", "COUNT"]).optional(),
  dimensions: z.array(z.string()).optional().describe("Available dimensions"),
  tags: z.record(z.string(), z.string()).optional().describe("Metric tags"),
});

export type Metric = z.infer<typeof MetricSchema>;

export const MetricDataSchema = z.object({
  metric: MetricSchema,
  currentValue: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  avgValue: z.number().optional(),
  dataPoints: z.array(DataPointSchema).optional().describe("Time series data points"),
  timeframeStart: z.number().optional().describe("Start timestamp"),
  timeframeEnd: z.number().optional().describe("End timestamp"),
  lastUpdated: z.number().describe("Last update timestamp"),
});

export type MetricData = z.infer<typeof MetricDataSchema>;

/**
 * Timeframe options for metric queries
 */
export const TimeframeOptions = {
  "1h": { label: "Last 1 hour", minutes: 60 },
  "6h": { label: "Last 6 hours", minutes: 360 },
  "24h": { label: "Last 24 hours", minutes: 1440 },
  "7d": { label: "Last 7 days", minutes: 10080 },
} as const;

export type TimeframeKey = keyof typeof TimeframeOptions;

/**
 * Preset metrics commonly used
 */
export const PresetMetrics = [
  {
    metricId: "builtin:host.cpu.usage",
    displayName: "CPU Usage",
    unit: "%",
  },
  {
    metricId: "builtin:host.mem.usage",
    displayName: "Memory Usage",
    unit: "%",
  },
  {
    metricId: "builtin:service.response.time",
    displayName: "Response Time",
    unit: "ms",
  },
  {
    metricId: "builtin:service.errors.rate",
    displayName: "Error Rate",
    unit: "%",
  },
  {
    metricId: "builtin:service.throughput",
    displayName: "Throughput",
    unit: "requests/min",
  },
] as const;

/**
 * Entity types for metric context
 */
export const EntityTypes = ["service", "host", "process_group"] as const;
export type EntityType = (typeof EntityTypes)[number];

export interface MetricEntity {
  id: string;
  name: string;
  type: EntityType;
}
