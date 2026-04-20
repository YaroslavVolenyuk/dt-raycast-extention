import { Detail, ActionPanel, Action, Icon, useNavigation } from "@raycast/api";
import { Problem } from "../../lib/types/problem";
import type { TenantConfig } from "../../lib/auth";

interface Props {
  problem: Problem;
  tenant: TenantConfig;
}

export default function ProblemDetailView({ problem, tenant }: Props) {
  const { push } = useNavigation();

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
    const url = `${tenant.tenantEndpoint}/ui/problems/${problem["event.id"]}`;
    // In a real app, we'd use Action.OpenInBrowser
    // For now, copy the URL to clipboard as a workaround
  };

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Open in Dynatrace"
            icon={Icon.Link}
            onAction={handleOpenInDynatrace}
          />
          <Action.CopyToClipboard content={problem["event.id"]} title="Copy Problem ID" />
          <Action.CopyToClipboard
            content={`${tenant.tenantEndpoint}/ui/problems/${problem["event.id"]}`}
            title="Copy Problem URL"
          />
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
