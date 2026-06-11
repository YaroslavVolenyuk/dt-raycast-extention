/**
 * Jira API integration for Dynatrace extension
 *
 * Supports both:
 * - Unscoped API tokens: https://mysite.atlassian.net
 * - Scoped API tokens: https://api.atlassian.com/ex/jira/{cloudId}
 *
 * Reference: https://jira.atlassian.com/browse/CLOUD-12617
 */

import { getPreferenceValues } from "@raycast/api";
import { parseJiraUrl } from "../utils/jiraUrlValidator";
import { assertHttps } from "../utils/urlSafety";

// Safe logger — never pass apiToken, authHeader, authString, email, request/response bodies.
function jiraLog(message: string, meta?: Record<string, string | number | boolean>) {
  console.log(`[Jira] ${message}`, meta ?? "");
}

export interface JiraIssueParams {
  summary: string;
  description: string;
  issueType: "Bug" | "Incident" | "Task";
  projectKey: string;
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
}

export interface JiraIssueResponse {
  key: string;
  id: string;
  self: string;
}

export class JiraError extends Error {
  constructor(
    public statusCode: number,
    public body: string,
  ) {
    super(`Jira API error: ${statusCode}`);
  }
}

/**
 * Resolve issue type ID dynamically from project, with in-process cache.
 * Falls back to hardcoded IDs only as last resort.
 */
const issueTypeCache = new Map<string, Array<{ id: string; name: string }>>();

async function resolveIssueTypeId(
  jiraUrl: string,
  email: string,
  apiToken: string,
  projectKey: string,
  issueTypeName: string,
): Promise<string> {
  let types = issueTypeCache.get(projectKey);
  if (!types) {
    const res = await getProjectIssueTypes(jiraUrl, email, apiToken, projectKey);
    if (!res.success || !res.issueTypes) {
      // Fallback to static map (instance-specific — may not match)
      const fallback: Record<string, string> = {
        Bug: "10011",
        Task: "10003",
        Story: "10004",
        Feature: "10009",
        Request: "10010",
        Epic: "10005",
        Incident: "10003",
      };
      return fallback[issueTypeName] ?? issueTypeName;
    }
    types = res.issueTypes;
    issueTypeCache.set(projectKey, types);
  }
  const match = types.find((t) => t.name.toLowerCase() === issueTypeName.toLowerCase());
  if (!match) {
    throw new Error(
      `Issue type "${issueTypeName}" not found in ${projectKey}. Available: ${types.map((t) => t.name).join(", ")}`,
    );
  }
  return match.id;
}

/**
 * Determine if URL is a scoped API token format
 */
function isScopedTokenUrl(jiraUrl: string): boolean {
  return jiraUrl.includes("api.atlassian.com/ex/jira");
}

/**
 * Get the correct API endpoint based on token type
 */
function getJiraApiEndpoint(jiraUrl: string): string {
  const cleanUrl = jiraUrl.replace(/\/$/, "");
  return `${cleanUrl}/rest/api/3/issue`;
}

/**
 * Create a Jira issue
 *
 * @param jiraUrl - Base Jira URL (unscoped: https://mysite.atlassian.net or scoped: https://api.atlassian.com/ex/jira/{cloudId})
 * @param email - Jira email address
 * @param apiToken - Jira API token
 * @param params - Issue parameters
 */
export async function createJiraIssue(
  jiraUrl: string,
  email: string,
  apiToken: string,
  params: JiraIssueParams,
): Promise<JiraIssueResponse> {
  const parsed = parseJiraUrl(jiraUrl);
  if (!parsed.isValid) {
    throw new Error(parsed.error ?? "Invalid Jira URL");
  }
  assertHttps(jiraUrl, "Jira URL");

  const tokenType = isScopedTokenUrl(jiraUrl) ? "scoped" : "unscoped";
  const endpoint = getJiraApiEndpoint(jiraUrl);

  jiraLog("createIssue", {
    endpoint,
    tokenType,
    projectKey: params.projectKey,
    issueType: params.issueType,
    summaryLength: params.summary.length,
    descriptionLength: params.description.length,
  });

  const issueTypeId = await resolveIssueTypeId(jiraUrl, email, apiToken, params.projectKey, params.issueType);

  const body = {
    fields: {
      project: { key: params.projectKey },
      summary: params.summary.slice(0, 255),
      description: {
        version: 1,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: params.description }],
          },
        ],
      },
      issuetype: { id: issueTypeId },
      priority: { name: params.priority },
    },
  };

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString("base64");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      jiraLog("createIssue failed", { status: response.status });

      let userMessage = `Jira API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages?.length) {
          userMessage = errorData.errorMessages.join("; ");
        } else if (errorData.errors && Object.keys(errorData.errors).length) {
          userMessage = Object.entries(errorData.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ");
        }
      } catch {
        // responseText is not JSON
      }

      throw new JiraError(response.status, userMessage);
    }

    const data = JSON.parse(responseText);
    jiraLog("createIssue success", { issueKey: data.key });

    return {
      key: data.key,
      id: data.id,
      self: data.self,
    };
  } catch (error) {
    if (error instanceof JiraError) throw error;
    throw new Error(`Failed to create Jira issue: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate Jira issue URL from the "self" URL returned by API
 */
export function buildJiraIssueUrl(selfUrl: string, issueKey: string): string {
  try {
    const url = new URL(selfUrl);

    if (url.hostname === "api.atlassian.com") {
      return `https://yourorganization.atlassian.net/browse/${issueKey}`;
    }

    const baseUrl = `${url.protocol}//${url.hostname}`;
    return `${baseUrl}/browse/${issueKey}`;
  } catch {
    return `https://atlassian.net/browse/${issueKey}`;
  }
}

/**
 * Validate and diagnose Jira configuration
 */
export function validateJiraConfig(
  jiraUrl: string | undefined,
  email: string | undefined,
  apiToken: string | undefined,
  projectKey: string | undefined,
): {
  isComplete: boolean;
  issues: string[];
  tokenType?: string;
  endpoint?: string;
} {
  const issues: string[] = [];

  if (!jiraUrl) {
    issues.push("Jira URL is not configured");
  } else {
    const tokenType = isScopedTokenUrl(jiraUrl) ? "scoped" : "unscoped";
    if (tokenType === "scoped") {
      if (!jiraUrl.includes("api.atlassian.com/ex/jira/")) {
        issues.push("Scoped token URL should include 'api.atlassian.com/ex/jira/'");
      }
      const cloudIdMatch = jiraUrl.match(/api\.atlassian\.com\/ex\/jira\/([a-zA-Z0-9-]+)/);
      if (!cloudIdMatch?.[1]) {
        issues.push("Scoped token URL missing Cloud ID. Expected: https://api.atlassian.com/ex/jira/{cloudId}");
      }
    } else {
      if (!jiraUrl.match(/https?:\/\/[a-zA-Z0-9-]+\.atlassian\.net/)) {
        issues.push("Unscoped token URL should be: https://yoursite.atlassian.net");
      }
    }
  }

  if (!email) issues.push("Jira email is not configured");
  if (!apiToken) issues.push("Jira API token is not configured");
  if (!projectKey) issues.push("Jira project key is not configured");

  return {
    isComplete: issues.length === 0,
    issues,
    tokenType: jiraUrl ? (isScopedTokenUrl(jiraUrl) ? "scoped" : "unscoped") : undefined,
    endpoint: jiraUrl ? getJiraApiEndpoint(jiraUrl) : undefined,
  };
}

/**
 * Check if all required Jira preferences are set
 */
export function isJiraConfigured(): boolean {
  try {
    // Must be called from within a command/component context (not at module evaluation time)
    const p = getPreferenceValues<{
      jiraUrl?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      jiraProjectKey?: string;
    }>();
    return Boolean(p.jiraUrl && p.jiraEmail && p.jiraApiToken && p.jiraProjectKey);
  } catch {
    return false;
  }
}

/**
 * Get available issue types for a project
 */
export async function getProjectIssueTypes(
  jiraUrl: string,
  email: string,
  apiToken: string,
  projectKey: string,
): Promise<{
  success: boolean;
  issueTypes?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  const cleanUrl = jiraUrl.replace(/\/$/, "");
  const endpoint = `${cleanUrl}/rest/api/3/project/${projectKey}/issuetypes`;

  jiraLog("getProjectIssueTypes", { projectKey });

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString("base64");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      jiraLog("getProjectIssueTypes failed", { status: response.status });
      return {
        success: false,
        error: `Failed to get issue types: ${response.status}`,
      };
    }

    const data = JSON.parse(responseText);
    const issueTypes = data.map((type: { id: string; name: string }) => ({
      id: type.id,
      name: type.name,
    }));

    jiraLog("getProjectIssueTypes success", { count: issueTypes.length });

    return { success: true, issueTypes };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test if API token works with a simple authenticated request
 */
export async function testJiraApiToken(
  jiraUrl: string,
  email: string,
  apiToken: string,
): Promise<{
  success: boolean;
  status?: number;
  message: string;
  details?: Record<string, unknown>;
}> {
  const cleanUrl = jiraUrl.replace(/\/$/, "");
  const testEndpoint = `${cleanUrl}/rest/api/3/myself`;

  jiraLog("testJiraApiToken", { endpoint: testEndpoint });

  const authHeader = Buffer.from(`${email}:${apiToken}`).toString("base64");

  try {
    const response = await fetch(testEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();

    if (response.ok) {
      const data = JSON.parse(responseText);
      jiraLog("testJiraApiToken success");
      return {
        success: true,
        status: response.status,
        message: `Token is valid. Logged in as: ${data.displayName}`,
        details: {
          name: data.displayName,
        },
      };
    } else {
      jiraLog("testJiraApiToken failed", { status: response.status });
      return {
        success: false,
        status: response.status,
        message: `Token test failed with status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Token test error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get the correct Jira browse URL for an issue
 */
export async function getJiraIssueBrowseUrl(
  jiraUrl: string,
  issueKey: string,
  email: string,
  apiToken: string,
): Promise<string> {
  const cleanUrl = jiraUrl.replace(/\/$/, "");

  if (!cleanUrl.includes("api.atlassian.com/ex/jira")) {
    return `${cleanUrl}/browse/${issueKey}`;
  }

  try {
    const authHeader = Buffer.from(`${email}:${apiToken}`).toString("base64");
    const endpoint = `${cleanUrl}/rest/api/3/myself`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.emailAddress) {
        const domain = data.emailAddress.split("@")[1];
        if (domain && domain.includes("atlassian.net")) {
          return `https://${domain}/browse/${issueKey}`;
        }
      }
    }
  } catch {
    // Fall through to fallback
  }

  return `${cleanUrl}/browse/${issueKey}`;
}
