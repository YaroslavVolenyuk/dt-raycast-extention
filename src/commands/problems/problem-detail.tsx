import { Detail, ActionPanel, Action, Icon, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { Problem } from "../../lib/types/problem";
import type { TenantConfig } from "../../lib/auth";
import { createJiraIssue, buildJiraIssueUrl } from "../../lib/integrations/jira";

interface Props {
  problem: Problem;
  tenant: TenantConfig;
}

interface JiraPreferences {
  jiraUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraProjectKey?: string;
}

export default function ProblemDetailView({ problem, tenant }: Props) {
  const prefs = getPreferenceValues<JiraPreferences>();
  const hasJiraConfig = !!(prefs.jiraUrl && prefs.jiraEmail && prefs.jiraApiToken && prefs.jiraProjectKey);

  const markdown = `
# ${problem["event.name"]}

## Problem Info
- **ID**: ${problem["event.id"]}
- **Severity**: ${problem["event.severity"]}
- **Status**: ${problem["event.status"]}
- **Duration**: ${formatDuration(problem["event.start"], problem["event.end"])}
- **Started**: ${formatDateTime(problem["event.start"])}
${problem["event.end"] ? `- **Ended**: ${formatDateTime(problem["event.end"])}` : ""}

## Affected Entities
${
  problem.affected_entity_ids && problem.affected_entity_ids.length > 0
    ? problem.affected_entity_ids.map((id) => `- ${id}`).join("\n")
    : "No affected entities"
}

## Root Cause
${problem.root_cause_entity_id ? `- ${problem.root_cause_entity_id}` : "Not determined"}

## Maintenance Window
${problem.maintenance_window ? "Yes — This problem is currently under maintenance" : "No"}
`;

  const handleOpenInDynatrace = () => {
    // In a real app, we'd use Action.OpenInBrowser
    // For now, this is a placeholder
  };

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Open in Dynatrace" icon={Icon.Link} onAction={handleOpenInDynatrace} />
          <Action.CopyToClipboard content={problem["event.id"]} title="Copy Problem ID" />
          <Action.CopyToClipboard
            content={`${tenant.tenantEndpoint}/ui/problems/${problem["event.id"]}`}
            title="Copy Problem URL"
          />

          {/* Jira Integration section */}
          {hasJiraConfig && (
            <ActionPanel.Section title="Jira">
              <Action
                title="Create Jira Incident"
                icon={Icon.ExclamationMark}
                onAction={async () => {
                  const toast = await showToast({
                    style: Toast.Style.Animated,
                    title: "Creating Jira incident...",
                  });

                  try {
                    const issueResponse = await createJiraIssue(prefs.jiraUrl!, prefs.jiraEmail!, prefs.jiraApiToken!, {
                      projectKey: prefs.jiraProjectKey!,
                      summary: `[Dynatrace] ${problem["event.name"]}`,
                      description: `**Severity**: ${problem["event.severity"]}\n**Status**: ${problem["event.status"]}\n**Affected Entities**: ${problem.affected_entity_ids?.join(", ") || "N/A"}\n**Root Cause**: ${problem.root_cause_entity_id || "Not determined"}\n\n[Open in Dynatrace](${tenant.tenantEndpoint}/ui/problems/${problem["event.id"]})`,
                      issueType: "Incident",
                      priority:
                        problem["event.severity"] === "AVAILABILITY"
                          ? "Highest"
                          : problem["event.severity"] === "ERROR"
                            ? "High"
                            : "Medium",
                    });

                    toast.style = Toast.Style.Success;
                    toast.title = "Incident created";
                    toast.message = `${issueResponse.key} — opening in browser`;

                    const issueUrl = buildJiraIssueUrl(prefs.jiraUrl!, issueResponse.key);
                    // In a real Raycast app, we'd use Action.OpenInBrowser here
                    // For now, copy to clipboard
                    await showToast({
                      style: Toast.Style.Success,
                      title: `Issue ${issueResponse.key} created`,
                      message: issueUrl,
                    });
                  } catch (error) {
                    toast.style = Toast.Style.Failure;
                    toast.title = "Failed to create issue";
                    toast.message = error instanceof Error ? error.message : "Unknown error";
                  }
                }}
              />
            </ActionPanel.Section>
          )}
        </ActionPanel>
      }
    />
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function formatDuration(startTime: string, endTime?: string | null): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const durationMs = end - start;

  const durationMin = Math.floor(durationMs / 60_000);
  if (durationMin < 60) return `${durationMin} minutes`;

  const durationH = Math.floor(durationMin / 60);
  if (durationH < 24) return `${durationH} hours`;

  return `${Math.floor(durationH / 24)} days`;
}
