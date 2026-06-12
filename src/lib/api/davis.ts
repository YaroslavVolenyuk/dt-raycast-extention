// src/lib/api/davis.ts
// Davis CoPilot API client for NL2DQL, DQL2NL, and Ask operations

import { dynatraceRest } from "./rest";
import { TenantConfig } from "../auth";
import { isMockMode } from "../devMode";
import {
  DavisContext,
  DavisAnswer,
  DavisSource,
  NL2DQLResponse,
  DQL2NLResponse,
  ConversationMessage,
  nl2dqlResponseSchema,
  dql2nlResponseSchema,
  davisAnswerSchema,
} from "../types/davis";

// ── Mock Data Registry ────────────────────────────────────────────────────────

const MOCK_NL2DQL_PAIRS: Record<string, string> = {
  "error logs from payment service last hour":
    'fetch logs, filter by dt.entity.service_name == "payment-service" and loglevel == "ERROR" | fields timestamp, content',
  "what is the cpu usage of my kubernetes cluster":
    "fetch dt.entity.kubernetes.cluster | fields name, entity.name | lookup [fetch dt.entity.host | fields cpu.usage.percent] on entity.name",
  "show me all failed deployments in the last week":
    'fetch events, filter by type == "DEPLOYMENT_EVENT" and status == "FAILED" and timestamp > now() - 7d | fields timestamp, service_name, status',
  "find slow transactions in the order service":
    'fetch spans, filter by dt.entity.service_name == "order-service" and duration > 1000 | stats avg(duration), percentile(duration, 95) by trace_id',
  "list all problems from the last 24 hours":
    "fetch dt.davis.problems, filter by timestamp > now() - 24h | fields timestamp, title, severity, entity.name",
};

const MOCK_DQL2NL_PAIRS: Record<string, string> = {
  'fetch logs, filter by dt.entity.service_name == "payment-service" and loglevel == "ERROR"':
    "Retrieves error-level log entries from the payment-service, useful for investigating service errors and failures.",
  'fetch dt.davis.problems, filter by severity == "CRITICAL" | stats count() by entity.name':
    "Counts all critical-level problems grouped by entity name, giving you a summary of critical issues per service or host.",
  "fetch spans | stats avg(duration), percentile(duration, 95) by dt.entity.service_name":
    "Calculates average response time and 95th percentile latency for each service, helping identify slow services.",
  'fetch events, filter by type == "DEPLOYMENT" | stats count() by timeframe(1h)':
    "Shows deployment frequency per hour, useful for tracking deployment patterns and trends.",
  'fetch dt.entity.service | filter status == "PROBLEM" | fields name, status, problem_count':
    "Lists all services with problem status and their problem counts, great for quick health checks.",
};

const MOCK_ASK_ANSWERS: Record<string, DavisAnswer> = {
  "what's wrong with order-service": {
    text: "The order-service is experiencing a 23% error rate over the last 15 minutes, with response times averaging 2.3 seconds (normally ~150ms). This is likely due to database connection pool exhaustion.",
    messageToken: "mock-token-1",
    status: "SUCCESSFUL",
    state: {},
    metadata: { sources: [{ title: "Order Service - Service Error Rate", type: "METRIC" }] },
  },
  "are we having performance issues": {
    text: "I'm seeing elevated response times across multiple services in the last 30 minutes. The payment-service is slowest at 1.8 seconds median latency.",
    messageToken: "mock-token-2",
    status: "SUCCESSFUL",
    state: {},
  },
  "show latest deployments": {
    text: "Here are the 5 most recent deployments in the last hour:\n\n1. **payment-service** → v2.4.1 (13 min ago)\n2. **api-gateway** → v1.8.3 (34 min ago)\n3. **order-service** → v1.5.8 (52 min ago) - High error rate detected",
    messageToken: "mock-token-3",
    status: "SUCCESSFUL",
    state: {},
  },
  "check latency trends": {
    text: "Latency is trending upward. Currently at 235ms median, up from 150ms an hour ago.",
    messageToken: "mock-token-4",
    status: "SUCCESSFUL",
    state: {},
  },
  "error budget status slo": {
    text: "Your SLO error budget is at 42% remaining. The checkout-service SLO is most at risk with only 12% budget left for the current month.",
    messageToken: "mock-token-5",
    status: "SUCCESSFUL",
    state: {},
  },
};

// ── NL2DQL: Natural Language to DQL ───────────────────────────────────────────

/**
 * Convert natural language to DQL query
 * @param tenant - Tenant configuration
 * @param text - Natural language query (e.g., "error logs from payment service")
 * @returns Promise<string> - DQL query string
 */
export async function convertNl2Dql(tenant: TenantConfig, text: string): Promise<string> {
  if (isMockMode()) {
    // Look for matching mock query
    const lowerText = text.toLowerCase();
    for (const [query, dql] of Object.entries(MOCK_NL2DQL_PAIRS)) {
      if (lowerText.includes(query.split(" ")[0])) {
        return dql;
      }
    }
    // Default fallback
    return `fetch logs, filter by content contains "${text}" | fields timestamp, content`;
  }

  const response = await dynatraceRest<NL2DQLResponse>(tenant, "/platform/davis/copilot/v1/skills/nl2dql:generate", {
    method: "POST",
    body: { text },
    schema: nl2dqlResponseSchema,
  });

  return response.data.dql;
}

// ── DQL2NL: DQL to Natural Language (Explain Query) ──────────────────────────

/**
 * Explain a DQL query in natural language
 * @param tenant - Tenant configuration
 * @param dql - DQL query string
 * @returns Promise<string> - Natural language explanation
 */
export async function explainDql(tenant: TenantConfig, dql: string): Promise<string> {
  if (isMockMode()) {
    // Look for matching mock query
    for (const [mockDql, explanation] of Object.entries(MOCK_DQL2NL_PAIRS)) {
      if (dql.includes(mockDql.split(",")[0])) {
        return explanation;
      }
    }
    // Default fallback
    return `This DQL query fetches and filters data from Dynatrace. It appears to be analyzing: ${dql.slice(0, 100)}...`;
  }

  const response = await dynatraceRest<DQL2NLResponse>(tenant, "/platform/davis/copilot/v1/skills/dql2nl:explain", {
    method: "POST",
    body: { dql },
    schema: dql2nlResponseSchema,
  });

  return response.data.explanation;
}

// ── Ask Davis: General Question Answering ──────────────────────────────────────

/**
 * Ask Davis a single question.
 * Note: conversation context (follow-ups) is intentionally NOT supported —
 * the API call sends only the message text, so pretending to keep history
 * in the UI would be dishonest. Add it back only when messageToken-based
 * conversations are actually wired into the request.
 */
export async function askDavis(tenant: TenantConfig, message: string): Promise<DavisAnswer> {
  if (isMockMode()) {
    // Look for matching mock answer
    const lowerMessage = message.toLowerCase();
    for (const [question, answer] of Object.entries(MOCK_ASK_ANSWERS)) {
      if (lowerMessage.includes(question.split(" ")[0])) {
        return answer;
      }
    }

    // Default fallback
    return {
      text: `Based on the available data, "${message}" - however, I don't have a specific answer in mock mode. In production, I would analyze your Dynatrace metrics and logs to provide a detailed response.`,
      messageToken: "mock-token",
      status: "SUCCESSFUL" as const,
      state: {},
    };
  }

  const response = await dynatraceRest<DavisAnswer>(tenant, "/platform/davis/copilot/v1/skills/conversations:message", {
    method: "POST",
    body: { text: message },
    schema: davisAnswerSchema,
  });

  return response.data;
}

// ── Export types ────────────────────────────────────────────────────────────

export type { DavisContext, DavisAnswer, DavisSource, NL2DQLResponse, DQL2NLResponse, ConversationMessage };
