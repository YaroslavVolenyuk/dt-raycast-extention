// src/lib/types/davis.ts
// Types for Davis CoPilot API responses

import { z } from "zod";

// ── Davis Context (for conversation history) ──────────────────────────────────

export const davisContextSchema = z.object({
  entityName: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  timeframeStart: z.string().optional(),
  timeframeEnd: z.string().optional(),
  customContext: z.record(z.string(), z.unknown()).optional(),
});

export type DavisContext = z.infer<typeof davisContextSchema>;

// ── Davis Answer (from ask endpoint) ──────────────────────────────────────────

export const davisSourceSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  entityId: z.string().optional(),
  type: z.enum(["PROBLEM", "TRACE", "LOG", "METRIC", "ENTITY"]).optional(),
});

export const davisAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(davisSourceSchema).optional(),
  context: davisContextSchema.optional(),
});

export type DavisSource = z.infer<typeof davisSourceSchema>;
export type DavisAnswer = z.infer<typeof davisAnswerSchema>;

// ── NL2DQL Response ──────────────────────────────────────────────────────────

export const nl2dqlResponseSchema = z.object({
  dql: z.string(),
  explanation: z.string().optional(),
});

export type NL2DQLResponse = z.infer<typeof nl2dqlResponseSchema>;

// ── DQL2NL Response ──────────────────────────────────────────────────────────

export const dql2nlResponseSchema = z.object({
  explanation: z.string(),
  summary: z.string().optional(),
});

export type DQL2NLResponse = z.infer<typeof dql2nlResponseSchema>;

// ── Conversation Message ─────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

// ── Error type for Davis ─────────────────────────────────────────────────────

export class DavisCopilotUnavailableError extends Error {
  constructor(public statusCode: number = 403) {
    super("Davis CoPilot requires a Platform Subscription or is not available in your environment");
    this.name = "DavisCopilotUnavailableError";
  }
}
