/**
 * Jira API integration for Dynatrace extension
 */

export interface JiraIssueParams {
  summary: string;
  description: string;
  issueType: "Bug" | "Incident" | "Task";
  projectKey: string;
  priority?: "Highest" | "High" | "Medium" | "Low" | "Lowest";
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
 * Create a Jira issue
 */
export async function createJiraIssue(
  jiraUrl: string,
  email: string,
  apiToken: string,
  params: JiraIssueParams,
): Promise<JiraIssueResponse> {
  const endpoint = `${jiraUrl.replace(/\/$/, "")}/rest/api/3/issues`;

  // Build request body in Jira REST API format
  const body = {
    fields: {
      project: { key: params.projectKey },
      summary: params.summary,
      description: {
        version: 3,
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: params.description }],
          },
        ],
      },
      issuetype: { name: params.issueType },
      ...(params.priority && { priority: { name: params.priority } }),
    },
  };

  // Basic Auth: base64(email:apiToken)
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
      throw new JiraError(response.status, responseText);
    }

    const data = JSON.parse(responseText);
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
 * Generate Jira issue URL from response
 */
export function buildJiraIssueUrl(jiraUrl: string, issueKey: string): string {
  return `${jiraUrl.replace(/\/$/, "")}/browse/${issueKey}`;
}
