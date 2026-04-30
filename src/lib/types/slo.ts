// src/lib/types/slo.ts
import { z } from "zod";

export const sloSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  target: z.number(), // e.g., 99.9
  warning: z.number(), // e.g., 95.0
  compliance: z.number(), // current compliance percentage
  errorBudgetRemaining: z.number().nullable().optional(),
  evaluatedAt: z.string().datetime().optional(),
  timeframe: z.string(), // e.g., "7d", "30d"
  enabled: z.boolean().default(true),
  metricDefinition: z.string().nullable().optional(), // DQL or metric expression
});

export const sloListSchema = z.array(sloSchema);

export type SLO = z.infer<typeof sloSchema>;
