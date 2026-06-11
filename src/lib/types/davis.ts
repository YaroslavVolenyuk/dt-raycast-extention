// src/lib/types/davis.ts
// Types for Davis CoPilot API responses — aligned with @dynatrace-sdk/client-davis-copilot

import { z } from "zod";

// ── NL2DQL ────────────────────────────────────────────────────────────────────

export const nl2dqlResponseSchema = z.object({
  dql: z.string(),
  messageToken: z.string(),
  status: z.enum(["SUCCESSFUL", "SUCCESSFUL_WITH_WARNINGS", "FAILED"]),
  metadata: z.object({ notifications: z.array(z.unknown()).optional() }).optional(),
});

export type NL2DQLResponse = z.infer<typeof nl2dqlResponseSchema>;

// ── DQL2NL ────────────────────────────────────────────────────────────────────

export const dql2nlResponseSchema = z.object({
  summary: z.string(),
  explanation: z.string(),
  messageToken: z.string(),
  status: z.enum(["SUCCESSFUL", "SUCCESSFUL_WITH_WARNINGS", "FAILED"]),
  metadata: z.object({ notifications: z.array(z.unknown()).optional() }).optional(),
});

export type DQL2NLResponse = z.infer<typeof dql2nlResponseSchema>;

// ── Conversations ─────────────────────────────────────────────────────────────

export const davisSourceSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
});

export type DavisSource = z.infer<typeof davisSourceSchema>;

export const davisStateSchema = z.object({
  version: z.string().optional(),
  conversationId: z.string().optional(),
  skillName: z.string().optional(),
  history: z.array(z.unknown()).optional(),
});

export type DavisState = z.infer<typeof davisStateSchema>;

export const davisAnswerSchema = z.object({
  text: z.string(),
  messageToken: z.string(),
  status: z.enum(["SUCCESSFUL", "SUCCESSFUL_WITH_WARNINGS", "FAILED"]),
  state: davisStateSchema,
  metadata: z
    .object({
      notifications: z.array(z.unknown()).optional(),
      sources: z.array(davisSourceSchema).optional(),
    })
    .optional(),
});

export type DavisAnswer = z.infer<typeof davisAnswerSchema>;

// ── Context / legacy compat ───────────────────────────────────────────────────

export interface DavisContext {
  entityId?: string;
  entityType?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class DavisCopilotUnavailableError extends Error {
  constructor(public statusCode: number = 403) {
    super("Davis CoPilot requires a Platform Subscription or is not available in your environment");
    this.name = "DavisCopilotUnavailableError";
  }
}
